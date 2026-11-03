using System.Security.Claims;
using api.Data;
using api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers;

[ApiController, Authorize, Route("api/notifications")]
public sealed class NotificationsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<NotificationResponse>>> Get(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        // SQLite cannot order DateTimeOffset values; the autoincrementing id tracks creation order.
        var items = await db.Notifications.AsNoTracking().Where(item => item.UserId == userId)
            .OrderByDescending(item => item.Id).Take(50).ToListAsync(ct);
        return Ok(items.Select(ToResponse));
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<int>> GetUnreadCount(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        return Ok(await db.Notifications.CountAsync(item => item.UserId == userId && item.ReadAt == null, ct));
    }

    [HttpPatch("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var item = await db.Notifications.FirstOrDefaultAsync(notification => notification.Id == id && notification.UserId == userId, ct);
        if (item is null) return NotFound();
        item.ReadAt ??= DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var unread = await db.Notifications.Where(item => item.UserId == userId && item.ReadAt == null).ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        foreach (var item in unread) item.ReadAt = now;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static NotificationResponse ToResponse(NotificationEntity item) => new(
        item.Id, item.Type, item.Title, item.Body, item.JobId, item.ApplicationId, item.CreatedAt, item.ReadAt);
}
