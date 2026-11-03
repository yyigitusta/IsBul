using System.ComponentModel.DataAnnotations;

namespace api.Models;

public sealed class CreateJobApplicationRequest
{
    [StringLength(300, ErrorMessage = "Deneyim alanı en fazla 300 karakter olabilir.")]
    public string Experience { get; init; } = string.Empty;

    [Required(ErrorMessage = "İşverene mesaj zorunludur.")]
    [StringLength(800, MinimumLength = 10, ErrorMessage = "Mesaj 10 ile 800 karakter arasında olmalıdır.")]
    public string Message { get; init; } = string.Empty;
}
