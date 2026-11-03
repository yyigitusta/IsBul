namespace api.Models;

public sealed record JobListing(
    int Id,
    string Title,
    string Description,
    string Area,
    string Category,
    decimal DailyPayTry,
    int WorkerCount,
    DateOnly WorkDate,
    string EmployerName,
    DateTimeOffset CreatedAt,
    bool IsDemo,
    string Status = "open");
