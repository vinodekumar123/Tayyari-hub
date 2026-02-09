
import jsPDF from 'jspdf';

export const PRIMARY_COLOR: [number, number, number] = [37, 99, 235]; // Blue-600
export const SECONDARY_COLOR: [number, number, number] = [79, 70, 229]; // Indigo-600
export const DARK_COLOR: [number, number, number] = [30, 41, 59]; // Slate-800
export const LIGHT_SLATE: [number, number, number] = [100, 116, 139]; // Slate-500

export const logoBase64: string = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABGAAAADRCAYAAACD18RqAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAJglSURBVHhe7N13eFRl9gfw7zl3ZtJJIHSkFxVQxIKiqAiKIDas2LsiYltd3XVdy67uWn72gliw17U3FGyoqIiIINJ7xwAhpGfmnvP7Y2bC5IpKSTJ3wvk8zzxJ3nNnMoTJm7nnnve8gDHGGGOMMcYY4zMrV67M/PHHH10A4rpuhaqS9xhjUgl7B4wxxhhjjDHGmGRr1qxZj+nTpxMAbNq0KaSqTbzHGJNKLAFjjDHGGGOMMcZXYtUuI8aNGyfMTM8++6xbVVXV33ucMcYYY4wxxhhjjNkBkUikIjc3VwBoly5dXNd1n7ZlSMYYY4wxxhhjjDG1qLS0VIhIAGhaWpqEw+H53mOMMcYYY4wxxhhjzHYqKyvr++WXX0YAaOwmy5cvd1W1qfdYY4wxxhhjjDHGGLMdXNd9tk+fPhEiUgDKzHLfffdJOBwe5D3WGGOMMcYYY4wxxmwjVaVwOLwUgCRUwOiBBx4Yqays/FBVbTMZY4wxxhhjjDHGmB1RXl5ead68eW68/0v8FggEpKioSLzHG5MqLHNojDHGGGOMMcYXVJXS0tKOv/feewGgxo5HkUgEP/74I8rLyzsmjhtjjDHGGGOMMcaYbRQOh1e2bt3aTax+AaBEpIceemgkEolM8N7HGGOMMcYYY+rMWtVsVT1ZRK4UkXMqK3UvVa1xxdgYY1KJqgZ//PFHl5lrLD9KuEkkEilVVcd7X2OMMcYYY4ypda7rfrimsDwy8okZ4UNv+MI97Z7vwk99sjBSXhmucl13dnFxZQ9ET2a2uORcVUlV+c8SNn8WN8aY2qKqVFFR8chFF10U8TbgTaiCkddffz1cUVFxkvf+xvid/UE1xhhjjEkhqkoi8to9Hy4ddsfrc7m4uBjh8jIwu8hICyIzlKbd2zXFo5ftTbvt0qi0MqIXZaYFXvE+TlFRUddAINAjPT20L8B9AHQC0AKAA8CpqKjg9PT0CIB3NmzYcFGzZs2KVZViW8IaY0ytiyV8JTbP3O65avPmzWXVqlVTHcc5INao15iU8LsvamOMMcYY4y+qSpWVevw3Czb8b9h/p3BxSSlJaVE0ZeJqoBGAFE7IQW52umakZ+Lui/aV4Qe1c1Q1wswBVUVpaSmWLFmiS5ctk8WLFtHChYtQVLSRSkpLSVwBM2HRokUgYj311FN01KhRHAwGF4TD4cEZGRkLLRFjjKkLlZWVp3z11VcvHX744fxH56rMrLNmzdJu3bq1Zua13rgxfvW7L2pjjDHGGJMcsavAHC+3T4xFIu5X/f75/YHL1xfTyiVrCY4A5ZVASUH0rV1aCNkZhLz0CjRLK0Hr9BKNlK5HupaisrIKTsBBKBikYDCIQCAAxwmAmcDM0ZvjIOA4+Oabb1FZWYG0tDRkZGTggAP64o薮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";

export const getLogoBase64Prefix = (payload: string): string => {
    if (payload.startsWith('iVBOR') || payload.startsWith('iVBO')) return 'data:image/png;base64,';
    if (payload.startsWith('/9j/') || payload.startsWith('ffd8')) return 'data:image/jpeg;base64,';
    return 'data:image/png;base64,';
};

export const sanitizeText = (text: string | undefined): string => {
    if (!text) return '-';
    let clean = text
        .replace(/–/g, '-')
        .replace(/—/g, '-')
        .replace(/→/g, 'to')
        .replace(/“/g, '"')
        .replace(/”/g, '"')
        .replace(/‘/g, "'")
        .replace(/’/g, "'")
        .replace(/…/g, '...')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<b>/gi, '')
        .replace(/<\/b>/gi, '')
        .replace(/<strong>/gi, '')
        .replace(/<\/strong>/gi, '')
        .replace(/<i>/gi, '')
        .replace(/<\/i>/gi, '')
        .replace(/<em>/gi, '')
        .replace(/<\/em>/gi, '')
        .replace(/<u>/gi, '')
        .replace(/<\/u>/gi, '');

    // Strip any remaining HTML tags
    clean = clean.replace(/<[^>]*>?/gm, '');

    // Strip non-ASCII
    clean = clean.replace(/[^\x20-\x7E\n]/g, '');

    return clean;
};

export const addFooter = (doc: jsPDF, pageCount: number) => {
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);

        const footerY = doc.internal.pageSize.height - 10;

        // Left: Website
        doc.setFont("helvetica", "normal");
        doc.text("www.tayyarihub.com", margin, footerY);

        // Center: WhatsApp & Facebook (Social)
        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 211, 102); // WhatsApp Green
        const waText = "WhatsApp: 03237507673";
        const fbText = "fb.com/tayyarihub";
        const socialText = `${waText}  |  ${fbText}`;
        const socialWidth = doc.getTextWidth(socialText);
        doc.text(socialText, (pageWidth - socialWidth) / 2, footerY);

        // Right: Page Number
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, footerY);
    }
};

export const addHeader = (doc: jsPDF, title: string, subtitle?: string) => {
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    let currentY = 15;

    // Logo (Optional based on base64 validity)
    try {
        const payload = logoBase64.startsWith('data:') ? logoBase64.split(',')[1] : logoBase64;
        const format = logoBase64.includes('jpeg') || logoBase64.includes('jpg') ? 'JPEG' : 'PNG';
        doc.addImage(logoBase64, format, margin, currentY, 40, 10);
    } catch (e) {
        doc.setFontSize(22);
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.setFont("helvetica", "bold");
        doc.text("TAYYARI HUB", margin, currentY + 8);
    }

    doc.setFontSize(10);
    doc.setTextColor(LIGHT_SLATE[0], LIGHT_SLATE[1], LIGHT_SLATE[2]);
    doc.setFont("helvetica", "normal");
    doc.text("www.tayyarihub.com", pageWidth - margin - 40, currentY + 8);

    currentY += 20;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(DARK_COLOR[0], DARK_COLOR[1], DARK_COLOR[2]);
    doc.setFont("helvetica", "bold");
    doc.text(sanitizeText(title), margin, currentY);

    if (subtitle) {
        currentY += 7;
        doc.setFontSize(11);
        doc.setTextColor(LIGHT_SLATE[0], LIGHT_SLATE[1], LIGHT_SLATE[2]);
        doc.setFont("helvetica", "normal");
        doc.text(sanitizeText(subtitle), margin, currentY);
    }

    return currentY + 10;
};
