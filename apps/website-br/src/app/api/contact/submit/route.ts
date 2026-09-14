import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceApiUrl } from "@/lib/workspace-api";

interface ContactPayload {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  source?: string;
  extra_data?: Record<string, string | undefined>;
}

/**
 * POST /api/contact/submit — forwards lead to unified workspace API (CRM > Leads).
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ContactPayload;

    if (!payload.name || !payload.email || !payload.message) {
      return NextResponse.json(
        { message: "Nome, email e mensagem são obrigatórios." },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      return NextResponse.json({ message: "Email inválido" }, { status: 400 });
    }

    const source = payload.source ?? "website_contact";
    const extraData = {
      locale: "pt",
      country: "BR",
      region: "Brasil",
      site: "innexar.com.br",
      ...payload.extra_data,
    };

    const backendRes = await fetch(`${getWorkspaceApiUrl()}/api/public/web-to-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Id": "innexar-br",
        Referer: "https://innexar.com.br/contact",
      },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        phone: payload.phone ?? null,
        message: payload.message ?? null,
        source,
        extra_data: extraData,
      }),
    });

    if (!backendRes.ok) {
      console.error(
        "Backend web-to-lead error:",
        backendRes.status,
        await backendRes.text(),
      );
      return NextResponse.json(
        { message: "Erro ao registrar contato." },
        { status: 502 },
      );
    }

    const lead = (await backendRes.json()) as { id: number | string };

    return NextResponse.json({
      message: "Contato enviado com sucesso.",
      contactId: String(lead.id),
      email: payload.email,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error submitting contact:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
