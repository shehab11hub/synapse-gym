import QRCode from 'qrcode';

export async function generateQRDataUrl(text: string): Promise<string> {
  try {
    const url = await QRCode.toDataURL(text, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    return url;
  } catch (err) {
    console.error('Error generating QR code', err);
    return '';
  }
}
