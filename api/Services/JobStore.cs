using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public sealed class JobStore(AppDbContext db)
{
    public IReadOnlyList<JobListing> GetSnapshot() => db.Jobs.AsNoTracking().AsEnumerable()
        .OrderByDescending(job => job.CreatedAt).Select(ToModel).ToArray();

    public JobContact? GetContact(int jobId)
    {
        var job = db.Jobs.AsNoTracking().FirstOrDefault(item => item.Id == jobId);
        return job?.EmployerUserId is null || job.EmployerPhone is null ? null : new JobContact(job.EmployerUserId, job.EmployerPhone);
    }

    public async Task<JobListing> AddAsync(CreateJobRequest request, string employerUserId, string employerName, string employerPhone, CancellationToken cancellationToken)
    {
        var job = new JobEntity
        {
            Title = request.Title.Trim(), Description = request.Description.Trim(), Area = request.Area.Trim(),
            Category = request.Category.Trim(), DailyPayTry = request.DailyPayTry, WorkerCount = request.WorkerCount,
            WorkDate = request.WorkDate, EmployerName = employerName, CreatedAt = DateTimeOffset.UtcNow,
            IsDemo = false, EmployerUserId = employerUserId, EmployerPhone = employerPhone, Status = "open"
        };
        db.Jobs.Add(job);
        await db.SaveChangesAsync(cancellationToken);
        return ToModel(job);
    }

    public async Task<JobListing?> UpdateStatusAsync(int jobId, string status, CancellationToken cancellationToken)
    {
        var job = await db.Jobs.FirstOrDefaultAsync(item => item.Id == jobId, cancellationToken);
        if (job is null) return null;
        job.Status = status;
        await db.SaveChangesAsync(cancellationToken);
        return ToModel(job);
    }

    public async Task<JobListing?> UpdateAsync(int jobId, UpdateJobRequest request, CancellationToken cancellationToken)
    {
        var job = await db.Jobs.FirstOrDefaultAsync(item => item.Id == jobId, cancellationToken);
        if (job is null) return null;
        job.Title = request.Title.Trim(); job.Description = request.Description.Trim(); job.Area = request.Area.Trim();
        job.Category = request.Category.Trim(); job.DailyPayTry = request.DailyPayTry; job.WorkerCount = request.WorkerCount; job.WorkDate = request.WorkDate;
        await db.SaveChangesAsync(cancellationToken);
        return ToModel(job);
    }

    private static JobListing ToModel(JobEntity job) => new(
        job.Id, job.Title, job.Description, job.Area, job.Category, job.DailyPayTry,
        job.WorkerCount, job.WorkDate, job.EmployerName, job.CreatedAt, job.IsDemo, job.Status);
}

public sealed record JobContact(string EmployerUserId, string EmployerPhone);
