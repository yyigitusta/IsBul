using System.Security.Claims;
using api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers;

[ApiController, Authorize, Route("api/devices/push-token")]
public sealed class PushTokensController(AppDbContext db) : ControllerBase
{
    public sealed class PushTokenRequest { public string Token { get; init; } = string.Empty; }

    [HttpPut]
    public async Task<IActionResult> Register(PushTokenRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || request.Token.Length > 200) return BadRequest();
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var token = await db.PushTokens.FirstOrDefaultAsync(item => item.Token == request.Token, ct);
        if (token is null) db.PushTokens.Add(new PushTokenEntity { Token = request.Token, UserId = userId, UpdatedAt = DateTimeOffset.UtcNow });
        else { token.UserId = userId; token.UpdatedAt = DateTimeOffset.UtcNow; }
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> Remove(PushTokenRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var token = await db.PushTokens.FirstOrDefaultAsync(item => item.Token == request.Token && item.UserId == userId, ct);
        if (token is not null) { db.PushTokens.Remove(token); await db.SaveChangesAsync(ct); }
        return NoContent();
    }
}
