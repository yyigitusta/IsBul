using System.ComponentModel.DataAnnotations;

namespace api.Models;

public sealed class UpdateJobRequest
{
    [Required, StringLength(100, MinimumLength = 4)] public string Title { get; init; } = string.Empty;
    [Required, StringLength(1200, MinimumLength = 10)] public string Description { get; init; } = string.Empty;
    [Required, StringLength(100, MinimumLength = 2)] public string Area { get; init; } = string.Empty;
    [Required] public string Category { get; init; } = string.Empty;
    [Range(typeof(decimal), "1", "1000000")] public decimal DailyPayTry { get; init; }
    [Range(1, 100)] public int WorkerCount { get; init; }
    public DateOnly WorkDate { get; init; }
}

public sealed class CreateReportRequest
{
    public int? JobId { get; init; }
    public string? ReportedUserId { get; init; }
    [Required, StringLength(60, MinimumLength = 3)] public string Reason { get; init; } = string.Empty;
    [StringLength(1000)] public string Details { get; init; } = string.Empty;
}

public sealed record ReportResponse(int Id, string Status, DateTimeOffset CreatedAt);
public sealed class ReviewReportRequest
{
    [Required, RegularExpression("^(reviewed|dismissed)$")] public string Status { get; init; } = string.Empty;
}
