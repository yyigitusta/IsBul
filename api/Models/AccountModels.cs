using System.ComponentModel.DataAnnotations;

namespace api.Models;

public sealed record AccountUser(string Id, string Name, string Phone, string PasswordSalt, string PasswordHash, DateTimeOffset CreatedAt);
public sealed record PublicAccount(string Id, string Name, string Phone);
public sealed class RegisterRequest
{
    [Required, StringLength(80, MinimumLength = 2)] public string Name { get; init; } = string.Empty;
    [Required, StringLength(24, MinimumLength = 10)] public string Phone { get; init; } = string.Empty;
    [Required, StringLength(128, MinimumLength = 8)] public string Password { get; init; } = string.Empty;
}
public sealed class LoginRequest
{
    [Required] public string Phone { get; init; } = string.Empty;
    [Required] public string Password { get; init; } = string.Empty;
}
public sealed record AuthResponse(string Token, PublicAccount User);
public sealed record ContactResponse(string Phone, bool IsOwner);
public sealed record JobMembershipResponse(bool IsOwner, JobApplication? Application);
public sealed record NotificationResponse(int Id, string Type, string Title, string Body, int? JobId, int? ApplicationId, DateTimeOffset CreatedAt, DateTimeOffset? ReadAt);
public sealed record FavoritePreferencesResponse(IReadOnlyList<string> Areas, IReadOnlyList<string> Categories, bool NewJobAlertsEnabled, bool ApplicationAlertsEnabled, bool MessageAlertsEnabled);
public sealed class UpdateFavoritePreferencesRequest
{
    public string[] Areas { get; init; } = [];
    public string[] Categories { get; init; } = [];
    public bool NewJobAlertsEnabled { get; init; } = true;
    public bool ApplicationAlertsEnabled { get; init; } = true;
    public bool MessageAlertsEnabled { get; init; } = true;
}
public sealed class UpdateJobStatusRequest
{
    [Required, RegularExpression("^(open|filled|cancelled)$")]
    public string Status { get; init; } = string.Empty;
}
public sealed record ChatMessage(int Id, int JobId, int ApplicationId, string SenderUserId, string SenderName, string Text, DateTimeOffset CreatedAt);
public sealed class SendMessageRequest
{
    [Required, StringLength(1000, MinimumLength = 1)] public string Text { get; init; } = string.Empty;
}
