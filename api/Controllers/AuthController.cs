using System.Security.Claims;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[ApiController, Route("api/auth")]
public sealed class AuthController(AccountStore accounts, SessionStore sessions) : ControllerBase
{
    [AllowAnonymous, HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken ct)
    {
        if (AccountStore.NormalizePhone(request.Phone).Length < 10) return BadRequest(new ProblemDetails { Detail = "Geçerli bir telefon numarası gir." });
        var result = await accounts.RegisterAsync(request, ct);
        if (result.Conflict) return Conflict(new ProblemDetails { Detail = "Bu telefon numarasıyla kayıtlı hesap var." });
        return Ok(await CreateAsync(result.User!, ct));
    }
    [AllowAnonymous, HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var user = await accounts.VerifyAsync(request.Phone, request.Password, ct);
        return user is null ? Unauthorized(new ProblemDetails { Detail = "Telefon numarası veya şifre hatalı." }) : Ok(await CreateAsync(user, ct));
    }
    [Authorize, HttpGet("me")]
    public ActionResult<PublicAccount> Me() => Ok(CurrentUser());
    [Authorize, HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var authorization = Request.Headers.Authorization.ToString();
        if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            await sessions.RevokeAsync(authorization[7..].Trim(), ct);
        return NoContent();
    }
    private async Task<AuthResponse> CreateAsync(AccountUser user, CancellationToken ct) =>
        new(await sessions.CreateAsync(user, ct), new PublicAccount(user.Id, user.Name, user.Phone));
    private PublicAccount CurrentUser() => new(User.FindFirstValue(ClaimTypes.NameIdentifier)!, User.Identity!.Name!, User.FindFirstValue("phone")!);
}
