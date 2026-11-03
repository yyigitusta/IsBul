using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public sealed class ApplicationStore(AppDbContext db)
{
    public IReadOnlyList<JobApplication> GetForJob(int jobId) => db.Applications.AsNoTracking()
        .Where(application => application.JobId == jobId).AsEnumerable()
        .OrderByDescending(application => application.CreatedAt).Select(ToModel).ToArray();

    public IReadOnlyList<JobApplication> GetForUser(string userId) => db.Applications.AsNoTracking()
        .Where(application => application.ApplicantUserId == userId).AsEnumerable()
        .OrderByDescending(application => application.CreatedAt).Select(ToModel).ToArray();

    public JobApplication? Get(int jobId, int applicationId)
    {
        var application = db.Applications.AsNoTracking().FirstOrDefault(item => item.JobId == jobId && item.Id == applicationId);
        return application is null ? null : ToModel(application);
    }

    public async Task<JobApplication?> AddAsync(int jobId, CreateJobApplicationRequest request, string applicantUserId, string applicantName, CancellationToken cancellationToken)
    {
        var application = new ApplicationEntity
        {
            JobId = jobId, ApplicantName = applicantName, Experience = request.Experience.Trim(),
            Message = request.Message.Trim(), Status = "pending", CreatedAt = DateTimeOffset.UtcNow,
            ApplicantUserId = applicantUserId
        };
        db.Applications.Add(application);
        try { await db.SaveChangesAsync(cancellationToken); return ToModel(application); }
        catch (DbUpdateException) { return null; }
    }

    public async Task<JobApplication?> UpdateStatusAsync(int jobId, int applicationId, string status, CancellationToken cancellationToken)
    {
        var application = await db.Applications.FirstOrDefaultAsync(item =>
            item.JobId == jobId && item.Id == applicationId && item.Status == "pending", cancellationToken);
        if (application is null) return null;
        application.Status = status.ToLowerInvariant();
        await db.SaveChangesAsync(cancellationToken);
        return ToModel(application);
    }

    private static JobApplication ToModel(ApplicationEntity application) => new(
        application.Id, application.JobId, application.ApplicantName, application.Experience,
        application.Message, application.Status, application.CreatedAt, application.ApplicantUserId);
}
