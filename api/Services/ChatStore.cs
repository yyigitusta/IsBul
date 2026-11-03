using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public sealed class ChatStore(AppDbContext db)
{
    public IReadOnlyList<ChatMessage> Get(int jobId, int applicationId) => db.Messages.AsNoTracking()
        .Where(message => message.JobId == jobId && message.ApplicationId == applicationId).AsEnumerable()
        .OrderBy(message => message.CreatedAt).Select(ToModel).ToArray();

    public async Task<ChatMessage> Add(int jobId, int applicationId, string userId, string name, string text, CancellationToken ct)
    {
        var message = new MessageEntity
        {
            JobId = jobId, ApplicationId = applicationId, SenderUserId = userId,
            SenderName = name, Text = text.Trim(), CreatedAt = DateTimeOffset.UtcNow
        };
        db.Messages.Add(message);
        await db.SaveChangesAsync(ct);
        return ToModel(message);
    }

    private static ChatMessage ToModel(MessageEntity message) => new(
        message.Id, message.JobId, message.ApplicationId, message.SenderUserId,
        message.SenderName, message.Text, message.CreatedAt);
}
