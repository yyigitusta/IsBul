using System.Security.Claims;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[ApiController, Authorize, Route("api/jobs/{jobId:int}/applications/{applicationId:int}/messages")]
public sealed class ChatController(JobStore jobs, ApplicationStore applications, ChatStore messages, NotificationService notifications) : ControllerBase
{
    [HttpGet]
    public ActionResult<IEnumerable<ChatMessage>> Get(int jobId, int applicationId)
    { if (!CanAccess(jobId, applicationId)) return NotFound(); return Ok(messages.Get(jobId, applicationId)); }
    [HttpPost]
    public async Task<ActionResult<ChatMessage>> Send(int jobId, int applicationId, SendMessageRequest request, CancellationToken ct)
    {
        if (!CanAccess(jobId, applicationId)) return NotFound();
        var senderId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var msg = await messages.Add(jobId, applicationId, senderId, User.Identity!.Name!, request.Text, ct);
        var job = jobs.GetSnapshot().First(item => item.Id == jobId);
        var application = applications.Get(jobId, applicationId)!;
        var employerId = jobs.GetContact(jobId)!.EmployerUserId;
        var recipientId = senderId == employerId ? application.ApplicantUserId : employerId;
        if (!string.IsNullOrWhiteSpace(recipientId))
            await notifications.NotifyUserAsync(recipientId, "chat_message", "Yeni mesajın var",
                $"{job.Title} ilanındaki sohbetine yeni bir mesaj geldi.", jobId, applicationId, ct);
        return Ok(msg);
    }
    private bool CanAccess(int jobId, int applicationId)
    {
        var job = jobs.GetSnapshot().FirstOrDefault(x => x.Id == jobId); var application = applications.Get(jobId, applicationId); var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return job is not null && application is not null && application.Status == "accepted" && (jobs.GetContact(jobId)?.EmployerUserId == id || application.ApplicantUserId == id);
    }
}
