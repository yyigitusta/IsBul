using System.Security.Claims;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[ApiController, Authorize, Route("api/jobs/{jobId:int}/applications")]
public sealed class JobApplicationsController(JobStore jobs, ApplicationStore applications, NotificationService notifications) : ControllerBase
{
    [HttpGet]
    public ActionResult<IEnumerable<JobApplication>> GetForJob(int jobId)
    { var job = jobs.GetSnapshot().FirstOrDefault(x => x.Id == jobId); if (job is null || jobs.GetContact(jobId)?.EmployerUserId != UserId) return NotFound(); return Ok(applications.GetForJob(jobId)); }

    [HttpGet("/api/applications/mine")]
    public ActionResult<IEnumerable<JobApplication>> GetMine() => Ok(applications.GetForUser(UserId));

    [HttpPost]
    public async Task<ActionResult<JobApplication>> Create(int jobId, CreateJobApplicationRequest request, CancellationToken ct)
    {
        var job = jobs.GetSnapshot().FirstOrDefault(x => x.Id == jobId); if (job is null) return NotFound();
        if (job.Status != "open") return Conflict(new ProblemDetails { Detail = "Bu ilan başvuruya kapalı." });
        var contact = jobs.GetContact(jobId);
        if (job.IsDemo || contact is null) return Conflict(new ProblemDetails { Detail = "Örnek ilanlar başvuru kabul etmiyor." });
        if (contact.EmployerUserId == UserId) return Conflict(new ProblemDetails { Detail = "Kendi ilanına başvuramazsın." });
        if (applications.GetForUser(UserId).Any(item => item.JobId == jobId)) return Conflict(new ProblemDetails { Detail = "Bu ilana daha önce başvurdun." });
        var created = await applications.AddAsync(jobId, request, UserId, User.Identity!.Name!, ct);
        return created is null ? Conflict(new ProblemDetails { Detail = "Bu ilana daha önce başvurdun." }) : Ok(created);
    }

    [HttpPatch("{applicationId:int}")]
    public async Task<ActionResult<JobApplication>> UpdateStatus(int jobId, int applicationId, UpdateApplicationStatusRequest request, CancellationToken ct)
    {
        var job = jobs.GetSnapshot().FirstOrDefault(x => x.Id == jobId); if (job is null || jobs.GetContact(jobId)?.EmployerUserId != UserId) return NotFound();
        var updated = await applications.UpdateStatusAsync(jobId, applicationId, request.Status, ct);
        if (updated is null) return NotFound();
        if (!string.IsNullOrWhiteSpace(updated.ApplicantUserId))
        {
            var statusText = updated.Status == "accepted" ? "kabul edildi" : "reddedildi";
            await notifications.NotifyUserAsync(updated.ApplicantUserId, "application_status", "Başvuruna yanıt geldi",
                $"{job.Title} ilanındaki başvurun {statusText}.", jobId, applicationId, ct);
        }
        return Ok(updated);
    }
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
}
