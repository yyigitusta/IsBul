using System.Globalization;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class JobsController(JobStore store, ApplicationStore applications, NotificationService notifications) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<JobListing>), StatusCodes.Status200OK)]
    public ActionResult<IEnumerable<JobListing>> Get(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] string? area,
        [FromQuery] decimal? minimumPay,
        [FromQuery] decimal? maximumPay,
        [FromQuery] DateOnly? workDate,
        [FromQuery] string sort = "recent",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1 || pageSize < 1)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Sayfalama değeri geçersiz.",
                Detail = "page ve pageSize pozitif tam sayı olmalıdır."
            });
        }

        if (minimumPay < 0 || maximumPay < 0 || (minimumPay.HasValue && maximumPay.HasValue && minimumPay > maximumPay))
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Yevmiye aralığı geçersiz.",
                Detail = "minimumPay, maximumPay değerinden büyük olamaz."
            });
        }

        var query = store.GetSnapshot().Where(job => job.Status == "open" && job.WorkDate >= DateOnly.FromDateTime(DateTime.Today));

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(job =>
                Contains(job.Title, search) ||
                Contains(job.Description, search) ||
                Contains(job.Area, search) ||
                Contains(job.EmployerName, search));
        }

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("Tümü", StringComparison.CurrentCultureIgnoreCase))
        {
            query = query.Where(job => string.Equals(job.Category, category, StringComparison.CurrentCultureIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(area))
        {
            query = query.Where(job => Contains(job.Area, area));
        }

        if (minimumPay.HasValue)
        {
            query = query.Where(job => job.DailyPayTry >= minimumPay.Value);
        }

        if (maximumPay.HasValue)
        {
            query = query.Where(job => job.DailyPayTry <= maximumPay.Value);
        }

        if (workDate.HasValue)
        {
            query = query.Where(job => job.WorkDate == workDate.Value);
        }

        IOrderedEnumerable<JobListing> ordered = sort.ToLowerInvariant() switch
        {
            "pay_asc" => query.OrderBy(job => job.DailyPayTry).ThenByDescending(job => job.CreatedAt),
            "pay_desc" => query.OrderByDescending(job => job.DailyPayTry).ThenByDescending(job => job.CreatedAt),
            "date_asc" => query.OrderBy(job => job.WorkDate).ThenByDescending(job => job.CreatedAt),
            "recent" => query.OrderByDescending(job => job.CreatedAt),
            _ => query.OrderByDescending(job => job.CreatedAt)
        };

        var totalCount = query.Count();
        var normalizedPageSize = Math.Min(pageSize, 50);
        var items = ordered.Skip((page - 1) * normalizedPageSize).Take(normalizedPageSize).ToArray();

        Response.Headers["X-Total-Count"] = totalCount.ToString(CultureInfo.InvariantCulture);
        Response.Headers["X-Page"] = page.ToString(CultureInfo.InvariantCulture);
        Response.Headers["X-Page-Size"] = normalizedPageSize.ToString(CultureInfo.InvariantCulture);

        return Ok(items);
    }

    [HttpGet("categories")]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    public ActionResult<IEnumerable<string>> GetCategories() => Ok(JobCatalog.Categories);

    [HttpGet("areas")]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    public ActionResult<IEnumerable<string>> GetAreas() => Ok(JobCatalog.Areas);

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(JobListing), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<JobListing> GetById(int id)
    {
        var job = store.GetSnapshot().FirstOrDefault(item => item.Id == id);
        return job is null ? NotFound() : Ok(job);
    }

    [Authorize, HttpPatch("{id:int}/status")]
    public async Task<ActionResult<JobListing>> UpdateStatus(int id, UpdateJobStatusRequest request, CancellationToken ct)
    {
        var job = store.GetSnapshot().FirstOrDefault(item => item.Id == id);
        if (job is null || store.GetContact(id)?.EmployerUserId != User.FindFirstValue(ClaimTypes.NameIdentifier)) return NotFound();
        var updated = await store.UpdateStatusAsync(id, request.Status, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [Authorize, HttpPut("{id:int}")]
    public async Task<ActionResult<JobListing>> Update(int id, UpdateJobRequest request, CancellationToken ct)
    {
        var job = store.GetSnapshot().FirstOrDefault(item => item.Id == id);
        if (job is null || store.GetContact(id)?.EmployerUserId != User.FindFirstValue(ClaimTypes.NameIdentifier)) return NotFound();
        if (!JobCatalog.Categories.Contains(request.Category, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new ProblemDetails { Detail = "Geçerli bir iş kategorisi seç." });
        if (request.WorkDate < DateOnly.FromDateTime(DateTime.Today))
            return BadRequest(new ProblemDetails { Detail = "Çalışma tarihi bugün veya daha ileri bir tarih olmalı." });
        var updated = await store.UpdateAsync(id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [Authorize, HttpGet("{id:int}/contact")]
    public ActionResult<ContactResponse> GetContact(int id)
    {
        var job = store.GetSnapshot().FirstOrDefault(item => item.Id == id);
        var contact = store.GetContact(id);
        if (job is null || contact is null) return NotFound();
        return Ok(new ContactResponse(contact.EmployerPhone, contact.EmployerUserId == User.FindFirstValue(ClaimTypes.NameIdentifier)));
    }

    [Authorize, HttpGet("{id:int}/membership")]
    public ActionResult<JobMembershipResponse> GetMembership(int id)
    {
        var job = store.GetSnapshot().FirstOrDefault(item => item.Id == id);
        if (job is null) return NotFound();
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        return Ok(new JobMembershipResponse(store.GetContact(id)?.EmployerUserId == userId, applications.GetForUser(userId).FirstOrDefault(x => x.JobId == id)));
    }

    [Authorize, HttpPost]
    [ProducesResponseType(typeof(JobListing), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<JobListing>> Create([FromBody] CreateJobRequest request, CancellationToken cancellationToken)
    {
        if (!JobCatalog.Categories.Contains(request.Category, StringComparer.CurrentCultureIgnoreCase))
        {
            ModelState.AddModelError(nameof(request.Category), "Seçilen kategori geçerli değil.");
        }

        if (request.WorkDate < DateOnly.FromDateTime(DateTime.Today))
        {
            ModelState.AddModelError(nameof(request.WorkDate), "İş tarihi bugün veya daha ileri bir tarih olmalıdır.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var created = await store.AddAsync(request, User.FindFirstValue(ClaimTypes.NameIdentifier)!, User.Identity!.Name!, User.FindFirstValue("phone")!, cancellationToken);
        await notifications.NotifyMatchingJobAsync(created, User.FindFirstValue(ClaimTypes.NameIdentifier)!, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    private static bool Contains(string source, string value) =>
        source.Contains(value.Trim(), StringComparison.CurrentCultureIgnoreCase);

}
