using System.Security.Claims;
using api.Data;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers;

[ApiController, Authorize, Route("api/me/preferences")]
public sealed class FavoritePreferencesController(AppDbContext db, NotificationService notifications) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<FavoritePreferencesResponse>> Get(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var preferences = await db.NotificationPreferences.AsNoTracking().FirstOrDefaultAsync(item => item.UserId == userId, ct);
        var areas = await db.FavoriteAreas.AsNoTracking().Where(item => item.UserId == userId).OrderBy(item => item.Area).Select(item => item.Area).ToArrayAsync(ct);
        var categories = await db.FavoriteCategories.AsNoTracking().Where(item => item.UserId == userId).OrderBy(item => item.Category).Select(item => item.Category).ToArrayAsync(ct);
        return Ok(new FavoritePreferencesResponse(areas, categories,
            preferences?.NewJobAlertsEnabled ?? true, preferences?.ApplicationAlertsEnabled ?? true, preferences?.MessageAlertsEnabled ?? true));
    }

    [HttpPut]
    public async Task<ActionResult<FavoritePreferencesResponse>> Update(UpdateFavoritePreferencesRequest request, CancellationToken ct)
    {
        if (request.Areas.Length > 10 || request.Categories.Length > JobCatalog.Categories.Length)
            return BadRequest(new ProblemDetails { Detail = "En fazla 10 bölge ve mevcut kategorilerden seçim yapabilirsin." });
        if (request.Areas.Any(area => !JobCatalog.Areas.Contains(area.Trim(), StringComparer.OrdinalIgnoreCase)) ||
            request.Categories.Any(category => !JobCatalog.Categories.Contains(category.Trim(), StringComparer.OrdinalIgnoreCase)))
            return BadRequest(new ProblemDetails { Detail = "Seçilen bölge veya iş türü geçerli değil." });

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var areas = request.Areas.Select(value => value.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var categories = request.Categories.Select(value => value.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var oldAreas = await db.FavoriteAreas.Where(item => item.UserId == userId).ToListAsync(ct);
        var oldCategories = await db.FavoriteCategories.Where(item => item.UserId == userId).ToListAsync(ct);
        db.FavoriteAreas.RemoveRange(oldAreas);
        db.FavoriteCategories.RemoveRange(oldCategories);
        db.FavoriteAreas.AddRange(areas.Select(area => new UserFavoriteAreaEntity { UserId = userId, Area = area }));
        db.FavoriteCategories.AddRange(categories.Select(category => new UserFavoriteCategoryEntity { UserId = userId, Category = category }));

        var preferences = await db.NotificationPreferences.FirstOrDefaultAsync(item => item.UserId == userId, ct);
        if (preferences is null)
        {
            preferences = new UserNotificationPreferenceEntity { UserId = userId };
            db.NotificationPreferences.Add(preferences);
        }
        preferences.NewJobAlertsEnabled = request.NewJobAlertsEnabled;
        preferences.ApplicationAlertsEnabled = request.ApplicationAlertsEnabled;
        preferences.MessageAlertsEnabled = request.MessageAlertsEnabled;
        await db.SaveChangesAsync(ct);
        await notifications.NotifyMatchingExistingJobsAsync(userId, ct);

        return Ok(new FavoritePreferencesResponse(areas, categories, preferences.NewJobAlertsEnabled,
            preferences.ApplicationAlertsEnabled, preferences.MessageAlertsEnabled));
    }
}
