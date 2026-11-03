using System.ComponentModel.DataAnnotations;

namespace api.Models;

public sealed class CreateJobRequest
{
    [Required(ErrorMessage = "İlan başlığı zorunludur.")]
    [StringLength(100, MinimumLength = 4, ErrorMessage = "Başlık 4 ile 100 karakter arasında olmalıdır.")]
    public string Title { get; init; } = string.Empty;

    [Required(ErrorMessage = "İş açıklaması zorunludur.")]
    [StringLength(1200, MinimumLength = 10, ErrorMessage = "Açıklama 10 ile 1200 karakter arasında olmalıdır.")]
    public string Description { get; init; } = string.Empty;

    [Required(ErrorMessage = "Konum zorunludur.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Konum 2 ile 100 karakter arasında olmalıdır.")]
    public string Area { get; init; } = string.Empty;

    [Required(ErrorMessage = "Kategori zorunludur.")]
    public string Category { get; init; } = string.Empty;

    [Range(typeof(decimal), "1", "1000000", ErrorMessage = "Yevmiye 1 ile 1.000.000 TL arasında olmalıdır.")]
    public decimal DailyPayTry { get; init; }

    [Range(1, 100, ErrorMessage = "Çalışan sayısı 1 ile 100 arasında olmalıdır.")]
    public int WorkerCount { get; init; } = 1;

    public DateOnly WorkDate { get; init; }

}
