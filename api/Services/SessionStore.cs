using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public sealed class SessionStore(AppDbContext db)
{
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(30);

    public async Task<string> CreateAsync(AccountUser user, CancellationToken cancellationToken)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(36)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        db.Sessions.Add(new SessionEntity
        {
            TokenHash = Key(token),
            UserId = user.Id,
            ExpiresAt = DateTimeOffset.UtcNow.Add(SessionLifetime)
        });
        await db.SaveChangesAsync(cancellationToken);
        return token;
    }

    public async Task<ClaimsPrincipal?> ResolveAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var session = await db.Sessions.AsNoTracking().FirstOrDefaultAsync(item => item.TokenHash == Key(token), cancellationToken);
        if (session is null) return null;
        if (session.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            var expired = await db.Sessions.FirstOrDefaultAsync(item => item.TokenHash == session.TokenHash, cancellationToken);
            if (expired is not null) { db.Sessions.Remove(expired); await db.SaveChangesAsync(cancellationToken); }
            return null;
        }
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(item => item.Id == session.UserId, cancellationToken);
        if (user is null) return null;
        var identity = new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim("phone", user.Phone)
        ], "Bearer");
        return new ClaimsPrincipal(identity);
    }

    public async Task RevokeAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return;
        var session = await db.Sessions.FirstOrDefaultAsync(item => item.TokenHash == Key(token), cancellationToken);
        if (session is null) return;
        db.Sessions.Remove(session);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static string Key(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
