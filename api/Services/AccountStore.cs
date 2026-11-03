using System.Security.Cryptography;
using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public sealed class AccountStore(AppDbContext db)
{
    public async Task<(AccountUser? User, bool Conflict)> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var phone = NormalizePhone(request.Phone);
        if (await db.Users.AnyAsync(user => user.Phone == phone, ct)) return (null, true);
        var salt = RandomNumberGenerator.GetBytes(16);
        var user = new AccountUser(Guid.NewGuid().ToString("N"), request.Name.Trim(), phone,
            Convert.ToBase64String(salt), Hash(request.Password, salt), DateTimeOffset.UtcNow);
        db.Users.Add(ToEntity(user));
        try { await db.SaveChangesAsync(ct); return (user, false); }
        catch (DbUpdateException) { return (null, true); }
    }

    public async Task<AccountUser?> VerifyAsync(string phone, string password, CancellationToken ct)
    {
        var normalized = NormalizePhone(phone);
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(item => item.Phone == normalized, ct);
        if (user is null) return null;
        try
        {
            var expected = Convert.FromBase64String(user.PasswordHash);
            var actual = Convert.FromBase64String(Hash(password, Convert.FromBase64String(user.PasswordSalt)));
            return CryptographicOperations.FixedTimeEquals(expected, actual) ? ToModel(user) : null;
        }
        catch (FormatException) { return null; }
    }

    public static string NormalizePhone(string phone) => new(phone.Where(char.IsDigit).ToArray());
    private static string Hash(string password, byte[] salt) => Convert.ToBase64String(Rfc2898DeriveBytes.Pbkdf2(password, salt, 310_000, HashAlgorithmName.SHA256, 32));
    private static AccountUser ToModel(UserEntity user) => new(user.Id, user.Name, user.Phone, user.PasswordSalt, user.PasswordHash, user.CreatedAt);
    private static UserEntity ToEntity(AccountUser user) => new() { Id = user.Id, Name = user.Name, Phone = user.Phone, PasswordSalt = user.PasswordSalt, PasswordHash = user.PasswordHash, CreatedAt = user.CreatedAt };
}
