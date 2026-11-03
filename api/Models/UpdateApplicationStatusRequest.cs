using System.ComponentModel.DataAnnotations;

namespace api.Models;

public sealed class UpdateApplicationStatusRequest
{
    [Required]
    [RegularExpression("^(accepted|declined)$", ErrorMessage = "Durum accepted veya declined olmalıdır.")]
    public string Status { get; init; } = string.Empty;
}
