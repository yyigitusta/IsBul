using System.Net;
using api.Data;
using api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
var dataDirectory = Path.Combine(builder.Environment.ContentRootPath, "App_Data");
Directory.CreateDirectory(dataDirectory);
var connection = new SqliteConnectionStringBuilder(
    builder.Configuration.GetConnectionString("Default") ?? "Data Source=App_Data/yevmiye.db");
if (!Path.IsPathRooted(connection.DataSource))
    connection.DataSource = Path.GetFullPath(connection.DataSource, builder.Environment.ContentRootPath);
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connection.ConnectionString));
builder.Services.AddScoped<JobStore>();
builder.Services.AddScoped<ApplicationStore>();
builder.Services.AddScoped<AccountStore>();
builder.Services.AddScoped<SessionStore>();
builder.Services.AddScoped<ChatStore>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddHttpClient<ExpoPushService>();
builder.Services.AddAuthorization();
var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy("ClientApp", policy =>
{
    policy.AllowAnyHeader().WithExposedHeaders("X-Total-Count", "X-Page", "X-Page-Size").AllowAnyMethod();
    if (builder.Environment.IsDevelopment())
    {
        policy.SetIsOriginAllowed(origin =>
            configuredOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase) ||
            (Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
             (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
              (IPAddress.TryParse(uri.Host, out var address) && IPAddress.IsLoopback(address)))));
    }
    else if (configuredOrigins.Length > 0)
    {
        policy.WithOrigins(configuredOrigins);
    }
}));
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DatabaseInitializer.InitializeAsync(database, dataDirectory);
}

app.Use(async (context, next) =>
{
    var sessions = context.RequestServices.GetRequiredService<SessionStore>();
    var header = context.Request.Headers.Authorization.ToString();
    if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        var principal = await sessions.ResolveAsync(header[7..].Trim(), context.RequestAborted);
        if (principal is not null) context.User = principal;
    }
    await next();
});

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("ClientApp");
app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
