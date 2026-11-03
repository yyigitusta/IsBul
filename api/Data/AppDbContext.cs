using Microsoft.EntityFrameworkCore;

namespace api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<UserEntity> Users => Set<UserEntity>();
    public DbSet<JobEntity> Jobs => Set<JobEntity>();
    public DbSet<ApplicationEntity> Applications => Set<ApplicationEntity>();
    public DbSet<MessageEntity> Messages => Set<MessageEntity>();
    public DbSet<SessionEntity> Sessions => Set<SessionEntity>();
    public DbSet<UserNotificationPreferenceEntity> NotificationPreferences => Set<UserNotificationPreferenceEntity>();
    public DbSet<UserFavoriteAreaEntity> FavoriteAreas => Set<UserFavoriteAreaEntity>();
    public DbSet<UserFavoriteCategoryEntity> FavoriteCategories => Set<UserFavoriteCategoryEntity>();
    public DbSet<NotificationEntity> Notifications => Set<NotificationEntity>();
    public DbSet<ReportEntity> Reports => Set<ReportEntity>();
    public DbSet<PushTokenEntity> PushTokens => Set<PushTokenEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserEntity>().HasKey(x => x.Id);
        modelBuilder.Entity<UserEntity>().HasIndex(x => x.Phone).IsUnique();
        modelBuilder.Entity<JobEntity>().HasKey(x => x.Id);
        modelBuilder.Entity<JobEntity>().Property(x => x.DailyPayTry).HasConversion<double>();
        modelBuilder.Entity<JobEntity>().Property(x => x.WorkDate).HasConversion<string>();
        modelBuilder.Entity<JobEntity>().HasIndex(x => x.CreatedAt);
        modelBuilder.Entity<JobEntity>().Property(x => x.Status).HasDefaultValue("open");
        modelBuilder.Entity<ApplicationEntity>().HasKey(x => x.Id);
        modelBuilder.Entity<ApplicationEntity>().HasIndex(x => new { x.JobId, x.ApplicantUserId }).IsUnique();
        modelBuilder.Entity<ApplicationEntity>().HasOne<JobEntity>().WithMany().HasForeignKey(x => x.JobId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<MessageEntity>().HasKey(x => x.Id);
        modelBuilder.Entity<MessageEntity>().HasIndex(x => new { x.JobId, x.ApplicationId, x.CreatedAt });
        modelBuilder.Entity<MessageEntity>().HasOne<ApplicationEntity>().WithMany().HasForeignKey(x => x.ApplicationId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<SessionEntity>().HasKey(x => x.TokenHash);
        modelBuilder.Entity<SessionEntity>().HasIndex(x => x.ExpiresAt);
        modelBuilder.Entity<SessionEntity>().HasOne<UserEntity>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<UserNotificationPreferenceEntity>().HasKey(x => x.UserId);
        modelBuilder.Entity<UserNotificationPreferenceEntity>().HasOne<UserEntity>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<UserFavoriteAreaEntity>().HasKey(x => x.Id);
        modelBuilder.Entity<UserFavoriteAreaEntity>().HasIndex(x => new { x.UserId, x.Area }).IsUnique();
        modelBuilder.Entity<UserFavoriteAreaEntity>().HasOne<UserEntity>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<UserFavoriteCategoryEntity>().HasKey(x => x.Id);
        modelBuilder.Entity<UserFavoriteCategoryEntity>().HasIndex(x => new { x.UserId, x.Category }).IsUnique();
        modelBuilder.Entity<UserFavoriteCategoryEntity>().HasOne<UserEntity>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<NotificationEntity>().HasKey(x => x.Id);
        modelBuilder.Entity<NotificationEntity>().HasIndex(x => new { x.UserId, x.ReadAt, x.CreatedAt });
        modelBuilder.Entity<NotificationEntity>().HasOne<UserEntity>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ReportEntity>().HasKey(x => x.Id);
        modelBuilder.Entity<ReportEntity>().HasIndex(x => new { x.ReporterUserId, x.CreatedAt });
        modelBuilder.Entity<ReportEntity>().HasOne<UserEntity>().WithMany().HasForeignKey(x => x.ReporterUserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PushTokenEntity>().HasKey(x => x.Token);
        modelBuilder.Entity<PushTokenEntity>().HasIndex(x => x.UserId);
        modelBuilder.Entity<PushTokenEntity>().HasOne<UserEntity>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class UserEntity
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string PasswordSalt { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class JobEntity
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal DailyPayTry { get; set; }
    public int WorkerCount { get; set; }
    public DateOnly WorkDate { get; set; }
    public string EmployerName { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public bool IsDemo { get; set; }
    public string? EmployerUserId { get; set; }
    public string? EmployerPhone { get; set; }
    public string Status { get; set; } = "open";
}

public sealed class ApplicationEntity
{
    public int Id { get; set; }
    public int JobId { get; set; }
    public string ApplicantName { get; set; } = string.Empty;
    public string Experience { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public DateTimeOffset CreatedAt { get; set; }
    public string ApplicantUserId { get; set; } = string.Empty;
}

public sealed class MessageEntity
{
    public int Id { get; set; }
    public int JobId { get; set; }
    public int ApplicationId { get; set; }
    public string SenderUserId { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class SessionEntity
{
    public string TokenHash { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
}

public sealed class UserNotificationPreferenceEntity
{
    public string UserId { get; set; } = string.Empty;
    public bool NewJobAlertsEnabled { get; set; } = true;
    public bool ApplicationAlertsEnabled { get; set; } = true;
    public bool MessageAlertsEnabled { get; set; } = true;
}

public sealed class UserFavoriteAreaEntity
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
}

public sealed class UserFavoriteCategoryEntity
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}

public sealed class NotificationEntity
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public int? JobId { get; set; }
    public int? ApplicationId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
}

public sealed class ReportEntity
{
    public int Id { get; set; }
    public string ReporterUserId { get; set; } = string.Empty;
    public int? JobId { get; set; }
    public string? ReportedUserId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class PushTokenEntity
{
    public string Token { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; set; }
}
