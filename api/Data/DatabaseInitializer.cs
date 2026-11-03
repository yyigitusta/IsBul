using System.Text.Json;
using System.Data;
using api.Models;
using api.Services;
using Microsoft.EntityFrameworkCore;

namespace api.Data;

public static class DatabaseInitializer
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const string InitialMigrationId = "20261102233705_InitialCreate";
    private const string EfProductVersion = "8.0.22";

    public static async Task InitializeAsync(AppDbContext db, string dataDirectory, CancellationToken cancellationToken = default)
    {
        await AdoptEnsureCreatedDatabaseAsync(db, cancellationToken);
        await db.Database.MigrateAsync(cancellationToken);

        var usersPath = Path.Combine(dataDirectory, "users.json");
        if (!await db.Users.AnyAsync(cancellationToken) && File.Exists(usersPath))
        {
            var users = Read<AccountUser>(usersPath);
            db.Users.AddRange(users.Select(user => new UserEntity
            {
                Id = user.Id, Name = user.Name, Phone = user.Phone, PasswordSalt = user.PasswordSalt,
                PasswordHash = user.PasswordHash, CreatedAt = user.CreatedAt
            }));
            await db.SaveChangesAsync(cancellationToken);
        }

        var jobsPath = Path.Combine(dataDirectory, "jobs.json");
        if (!await db.Jobs.AnyAsync(cancellationToken))
        {
            var contactsPath = Path.Combine(dataDirectory, "job-contacts.json");
            var contacts = File.Exists(contactsPath)
                ? JsonSerializer.Deserialize<Dictionary<int, JobContact>>(File.ReadAllText(contactsPath), JsonOptions) ?? []
                : [];
            var legacyJobs = File.Exists(jobsPath) ? Read<JobListing>(jobsPath) : [];
            var jobs = legacyJobs.Count > 0 ? legacyJobs : SampleJobs();
            db.Jobs.AddRange(jobs.Select(job => new JobEntity
            {
                Id = job.Id, Title = job.Title, Description = job.Description, Area = job.Area,
                Category = job.Category, DailyPayTry = job.DailyPayTry, WorkerCount = job.WorkerCount,
                WorkDate = job.WorkDate, EmployerName = job.EmployerName, CreatedAt = job.CreatedAt,
                IsDemo = job.IsDemo, Status = job.Status, EmployerUserId = contacts.GetValueOrDefault(job.Id)?.EmployerUserId,
                EmployerPhone = contacts.GetValueOrDefault(job.Id)?.EmployerPhone
            }));
            await db.SaveChangesAsync(cancellationToken);
        }

        var applicationsPath = Path.Combine(dataDirectory, "applications.json");
        if (!await db.Applications.AnyAsync(cancellationToken) && File.Exists(applicationsPath))
        {
            db.Applications.AddRange(Read<JobApplication>(applicationsPath).Where(application => db.Jobs.Local.Any(job => job.Id == application.JobId)).Select(application => new ApplicationEntity
            {
                Id = application.Id, JobId = application.JobId, ApplicantName = application.ApplicantName,
                Experience = application.Experience, Message = application.Message, Status = application.Status,
                CreatedAt = application.CreatedAt, ApplicantUserId = application.ApplicantUserId ?? string.Empty
            }).Where(application => application.ApplicantUserId.Length > 0));
            await db.SaveChangesAsync(cancellationToken);
        }

        var messagesPath = Path.Combine(dataDirectory, "messages.json");
        if (!await db.Messages.AnyAsync(cancellationToken) && File.Exists(messagesPath))
        {
            var applicationIds = await db.Applications.Select(application => application.Id).ToListAsync(cancellationToken);
            db.Messages.AddRange(Read<ChatMessage>(messagesPath).Where(message => applicationIds.Contains(message.ApplicationId)).Select(message => new MessageEntity
            {
                Id = message.Id, JobId = message.JobId, ApplicationId = message.ApplicationId,
                SenderUserId = message.SenderUserId, SenderName = message.SenderName,
                Text = message.Text, CreatedAt = message.CreatedAt
            }));
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private static async Task AdoptEnsureCreatedDatabaseAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var connection = db.Database.GetDbConnection();
        var openedHere = connection.State != ConnectionState.Open;
        if (openedHere) await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using (var command = connection.CreateCommand())
            {
                command.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table';";
                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken)) tables.Add(reader.GetString(0));
            }

            var requiredTables = new[] { "Users", "Jobs", "Applications", "Messages" };
            if (tables.Contains("__EFMigrationsHistory") || !requiredTables.All(tables.Contains)) return;

            // The earlier prototype used EnsureCreated. Record its matching initial schema as
            // applied so Migrate can preserve the existing SQLite data instead of recreating tables.
            await using (var command = connection.CreateCommand())
            {
                command.CommandText = "CREATE TABLE \"__EFMigrationsHistory\" (\"MigrationId\" TEXT NOT NULL CONSTRAINT \"PK___EFMigrationsHistory\" PRIMARY KEY, \"ProductVersion\" TEXT NOT NULL);";
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO \"__EFMigrationsHistory\" (\"MigrationId\", \"ProductVersion\") VALUES ({InitialMigrationId}, {EfProductVersion});",
                cancellationToken);
        }
        finally
        {
            if (openedHere) await db.Database.CloseConnectionAsync();
        }
    }

    private static List<T> Read<T>(string path) => JsonSerializer.Deserialize<List<T>>(File.ReadAllText(path), JsonOptions) ?? [];

    private static List<JobListing> SampleJobs()
    {
        var today = DateOnly.FromDateTime(DateTime.Today); var now = DateTimeOffset.UtcNow;
        return
        [
            new(1, "Zeytin bahçesinde hasat", "Hasat süresince zeytin toplama ve kasaları taşıma işi. Yemek işveren tarafından verilecektir.", "Boyalıca, İznik", "Tarım", 1200, 4, today, "İznik Zeytinlik", now.AddHours(-2), true),
            new(2, "Depo düzenleme ve taşıma", "Ürün kolilerinin düzenlenmesi ve araçlara yüklenmesine yardımcı olacak ekip arkadaşı aranıyor.", "İznik merkez", "Taşıma", 1000, 2, today.AddDays(1), "Göl Depo", now.AddHours(-5), true),
            new(3, "Bahçe temizliği", "Bahçede budama artıkları toplanacak ve alan temizlenecek. Eldiven ve temel ekipman sağlanır.", "Elbeyli, İznik", "Bahçe", 950, 1, today.AddDays(2), "Elbeyli Bahçe", now.AddDays(-1), true)
        ];
    }
}
