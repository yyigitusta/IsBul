using System.Net.Http.Json;
using api.Data;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public sealed class ExpoPushService(HttpClient http, AppDbContext db, ILogger<ExpoPushService> logger)
{
    public async Task SendAsync(string userId, string title, string body, object data, CancellationToken ct)
    {
        var tokens = await db.PushTokens.Where(item => item.UserId == userId).Select(item => item.Token).ToListAsync(ct);
        if (tokens.Count == 0) return;
        foreach (var token in tokens)
        {
            try
            {
                using var response = await http.PostAsJsonAsync("https://exp.host/--/api/v2/push/send", new
                {
                    to = token, title, body, data, sound = "default", priority = "high", channelId = "default"
                }, ct);
                if (!response.IsSuccessStatusCode) logger.LogWarning("Expo push delivery failed with HTTP {StatusCode}", response.StatusCode);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                logger.LogWarning(ex, "Expo push delivery could not reach the push service.");
            }
        }
    }
}
