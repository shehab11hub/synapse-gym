// Vercel Serverless Function: Members Directory Sync
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface MemberPayload {
  id: string;
  code: string;
  name: string;
  phone: string;
  type?: string;
  subscriptionPlan?: string;
  subscriptionFee?: number;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  remainingDays?: number;
  totalSessions?: number;
  remainingSessions?: number;
  active?: boolean;
  assignedSessionId?: string;
  notes?: string;
  authToken?: string;
}

// In-memory cache in warm serverless container
let directoryMembers: MemberPayload[] = [];

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch members or search by code/phone/id
  if (req.method === 'GET') {
    const { code, phone, id, q } = req.query;

    if (code || phone || id || q) {
      const queryStr = (code || phone || id || q) as string;
      const clean = queryStr.trim().toLowerCase();

      const found = directoryMembers.find(
        (m) =>
          m.id === clean ||
          m.code.toLowerCase() === clean ||
          m.phone.includes(clean) ||
          m.name.toLowerCase().includes(clean)
      );

      if (found) {
        return res.status(200).json({ success: true, member: found });
      }
      return res.status(404).json({ success: false, message: 'عضو غير موجود' });
    }

    return res.status(200).json({
      success: true,
      count: directoryMembers.length,
      members: directoryMembers,
    });
  }

  // POST: Sync or add members
  if (req.method === 'POST') {
    const body = req.body;

    // Batch sync array of members
    if (Array.isArray(body)) {
      const map = new Map<string, MemberPayload>();
      directoryMembers.forEach((m) => map.set(m.id, m));
      body.forEach((item: MemberPayload) => {
        if (item && item.id) {
          map.set(item.id, item);
        }
      });
      directoryMembers = Array.from(map.values());
      return res.status(200).json({ success: true, count: directoryMembers.length });
    }

    // Single member add/update
    if (body && (body.id || body.code || body.name)) {
      const id = body.id || `mem-${Date.now()}`;
      const memberObj: MemberPayload = {
        ...body,
        id,
      };

      const existingIdx = directoryMembers.findIndex(
        (m) => m.id === id || (m.code && m.code === body.code)
      );

      if (existingIdx >= 0) {
        directoryMembers[existingIdx] = { ...directoryMembers[existingIdx], ...memberObj };
      } else {
        directoryMembers.unshift(memberObj);
      }

      return res.status(200).json({ success: true, member: memberObj });
    }

    return res.status(400).json({ success: false, error: 'بيانات غير صالحة' });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
