// Vercel Serverless Function: Real-time Check-In Sync Relay
// Allows mobile phone scans to immediately reach the reception desk on any device
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CheckInPayload {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  memberType?: string;
  timestamp: string;
  method?: string;
  subscriptionValid?: boolean;
  seatingStatus?: string;
  assignedCategory?: string;
  assignedCoachId?: string;
  assignedCoachName?: string;
  assignedSessionId?: string;
  assignedSessionTitle?: string;
  paymentMode?: string;
  chargedAmount?: number;
}

// Global in-memory cache preserved across invocations in warm container
let liveCheckIns: CheckInPayload[] = [];

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch live check-in queue
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      count: liveCheckIns.length,
      logs: liveCheckIns,
    });
  }

  // POST: Receive new check-in from mobile phone
  if (req.method === 'POST') {
    const payload = req.body as CheckInPayload;

    if (payload && payload.id) {
      // Prepend and de-duplicate by ID
      liveCheckIns = [payload, ...liveCheckIns.filter((item) => item.id !== payload.id)].slice(0, 50);

      return res.status(200).json({
        success: true,
        message: 'تم تسجيل الحضور ونقله للاستقبال بنجاح',
        item: payload,
        logs: liveCheckIns,
      });
    }

    return res.status(400).json({ success: false, error: 'بيانات غير صالحة' });
  }

  // DELETE: Cancel/Remove check-in from queue
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (id && typeof id === 'string') {
      liveCheckIns = liveCheckIns.filter((item) => item.id !== id);
    } else {
      liveCheckIns = [];
    }

    return res.status(200).json({
      success: true,
      message: 'تم الحذف من القائمة',
      logs: liveCheckIns,
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
