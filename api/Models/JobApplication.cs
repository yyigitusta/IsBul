namespace api.Models;

public sealed record JobApplication(
    int Id,
    int JobId,
    string ApplicantName,
    string Experience,
    string Message,
    string Status,
    DateTimeOffset CreatedAt,
    string? ApplicantUserId = null);
