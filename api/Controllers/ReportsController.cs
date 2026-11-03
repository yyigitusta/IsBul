using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using api.Data;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers;

[ApiController, Authorize, Route("api/reports")]
public sealed class ReportsController(AppDbContext db, JobStore jobs, IConfiguration configuration) : ControllerBase
{
    [HttpGet("moderation")]
    public async Task<IActionResult> GetPending(CancellationToken ct)
    {
        if (!IsModerator()) return Unauthorized();
        var reports = await db.Reports.AsNoTracking().Where(item => item.Status == "pending")
            .OrderBy(item => item.Id).Take(100).ToListAsync(ct);
        return Ok(reports.Select(item => new { item.Id, item.JobId, item.ReportedUserId, item.Reason, item.Details, item.Status, item.CreatedAt }));
    }

    [HttpPatch("moderation/{id:int}")]
    public async Task<IActionResult> Review(int id, ReviewReportRequest request, CancellationToken ct)
    {
        if (!IsModerator()) return Unauthorized();
        var report = await db.Reports.FirstOrDefaultAsync(item => item.Id == id, ct);
        if (report is null) return NotFound();
        report.Status = request.Status;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost]
    public async Task<ActionResult<ReportResponse>> Create(CreateReportRequest request, CancellationToken ct)
    {
        if ((request.JobId is null) == string.IsNullOrWhiteSpace(request.ReportedUserId))
            return BadRequest(new ProblemDetails { Detail = "Bir ilanı veya üyeyi bildir." });

        if (request.JobId is int jobId)
        {
            var job = jobs.GetSnapshot().FirstOrDefault(item => item.Id == jobId);
            if (job is null) return NotFound();
            var contact = jobs.GetContact(jobId);
            if (contact?.EmployerUserId == User.FindFirstValue(ClaimTypes.NameIdentifier))
                return Conflict(new ProblemDetails { Detail = "Kendi ilanını bildiremezsin." });
            request = new CreateReportRequest { JobId = request.JobId, ReportedUserId = contact?.EmployerUserId, Reason = request.Reason, Details = request.Details };
        }

        var reporterId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var targetUserId = string.IsNullOrWhiteSpace(request.ReportedUserId) ? null : request.ReportedUserId.Trim();
        if (targetUserId == reporterId) return Conflict(new ProblemDetails { Detail = "Kendini bildiremezsin." });
        if (targetUserId is not null && !await db.Users.AnyAsync(user => user.Id == targetUserId, ct)) return NotFound();

        var entity = new ReportEntity
        {
            ReporterUserId = reporterId, JobId = request.JobId, ReportedUserId = targetUserId,
            Reason = request.Reason.Trim(), Details = request.Details.Trim(), CreatedAt = DateTimeOffset.UtcNow
        };
        db.Reports.Add(entity);
        await db.SaveChangesAsync(ct);
        return Ok(new ReportResponse(entity.Id, entity.Status, entity.CreatedAt));
    }

    private bool IsModerator()
    {
        var configured = configuration["Moderation:AdminKey"];
        var provided = Request.Headers["X-Moderation-Key"].ToString();
        if (string.IsNullOrEmpty(configured) || string.IsNullOrEmpty(provided)) return false;
        var expectedBytes = Encoding.UTF8.GetBytes(configured);
        var providedBytes = Encoding.UTF8.GetBytes(provided);
        return expectedBytes.Length == providedBytes.Length && CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
    }
}
