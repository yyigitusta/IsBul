using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public sealed class NotificationService(AppDbContext db, ExpoPushService push)
{
    public async Task NotifyMatchingExistingJobsAsync(string userId, CancellationToken ct)
    {
        var preferences = await db.NotificationPreferences.AsNoTracking().FirstOrDefaultAsync(item => item.UserId == userId, ct);
        if (preferences?.NewJobAlertsEnabled != true) return;

        var areas = await db.FavoriteAreas.AsNoTracking().Where(item => item.UserId == userId).Select(item => item.Area).ToArrayAsync(ct);
        var categories = await db.FavoriteCategories.AsNoTracking().Where(item => item.UserId == userId).Select(item => item.Category).ToArrayAsync(ct);
        if (areas.Length == 0 && categories.Length == 0) return;

        var jobs = await db.Jobs.AsNoTracking()
            .Where(job => job.Status == "open" && !job.IsDemo && job.WorkDate >= DateOnly.FromDateTime(DateTime.Today))
            .ToListAsync(ct);
        var priorJobIds = await db.Notifications.AsNoTracking()
            .Where(item => item.UserId == userId && item.Type == "new_job" && item.JobId != null)
            .Select(item => item.JobId!.Value).ToListAsync(ct);
        var priorJobIdSet = priorJobIds.ToHashSet();
        var pending = jobs
            .Where(job => job.EmployerUserId != userId && !priorJobIdSet.Contains(job.Id) && Matches(job.Area, job.Category, areas, categories))
            .Select(job => NewJobNotification(userId, job.Id, job.Area, job.Category, job.Title))
            .ToArray();
        if (pending.Length == 0) return;
        db.Notifications.AddRange(pending);
        await db.SaveChangesAsync(ct);
        foreach (var item in pending) await push.SendAsync(userId, item.Title, item.Body, new { type = item.Type, jobId = item.JobId }, ct);
    }

    public async Task NotifyMatchingJobAsync(JobListing job, string employerUserId, CancellationToken ct)
    {
        var enabledUsers = await db.NotificationPreferences.AsNoTracking()
            .Where(item => item.NewJobAlertsEnabled).Select(item => item.UserId).ToListAsync(ct);
        var areas = await db.FavoriteAreas.AsNoTracking().ToListAsync(ct);
        var categories = await db.FavoriteCategories.AsNoTracking().ToListAsync(ct);
        var notifications = new List<NotificationEntity>();

        foreach (var userId in enabledUsers.Where(id => id != employerUserId).Distinct())
        {
            var userAreas = areas.Where(item => item.UserId == userId).Select(item => item.Area).ToArray();
            var userCategories = categories.Where(item => item.UserId == userId).Select(item => item.Category).ToArray();
            if ((userAreas.Length == 0 && userCategories.Length == 0) || !Matches(job.Area, job.Category, userAreas, userCategories)) continue;
            var exists = await db.Notifications.AnyAsync(item => item.UserId == userId && item.Type == "new_job" && item.JobId == job.Id, ct);
            if (!exists) notifications.Add(NewJobNotification(userId, job.Id, job.Area, job.Category, job.Title));
        }

        if (notifications.Count == 0) return;
        db.Notifications.AddRange(notifications);
        await db.SaveChangesAsync(ct);
        foreach (var item in notifications) await push.SendAsync(item.UserId, item.Title, item.Body, new { type = item.Type, jobId = item.JobId }, ct);
    }

    public async Task NotifyUserAsync(string recipientUserId, string type, string title, string body, int? jobId, int? applicationId, CancellationToken ct)
    {
        var preferences = await db.NotificationPreferences.AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == recipientUserId, ct);
        var enabled = type switch
        {
            "application_status" => preferences?.ApplicationAlertsEnabled ?? true,
            "chat_message" => preferences?.MessageAlertsEnabled ?? true,
            _ => false
        };
        if (!enabled) return;
        db.Notifications.Add(new NotificationEntity
        {
            UserId = recipientUserId, Type = type, Title = title, Body = body,
            JobId = jobId, ApplicationId = applicationId, CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync(ct);
        await push.SendAsync(recipientUserId, title, body, new { type, jobId, applicationId }, ct);
    }

    private static bool Matches(string jobArea, string jobCategory, string[] areas, string[] categories)
    {
        var areaMatches = areas.Length == 0 || areas.Any(area => jobArea.Contains(area, StringComparison.OrdinalIgnoreCase));
        var categoryMatches = categories.Length == 0 || categories.Contains(jobCategory, StringComparer.OrdinalIgnoreCase);
        return areaMatches && categoryMatches;
    }

    private static NotificationEntity NewJobNotification(string userId, int jobId, string area, string category, string title) => new()
    {
        UserId = userId, Type = "new_job", Title = "Favorilerinde yeni iş",
        Body = $"{area} bölgesinde {category.ToLowerInvariant()} ilanı açıldı: {title}",
        JobId = jobId, CreatedAt = DateTimeOffset.UtcNow
    };
}
