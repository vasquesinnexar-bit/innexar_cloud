import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceApiUrl } from "@/lib/workspace-api";

interface ChecklistPayload {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  currentChallenges?: string;
  targetAudience?: string;
  businessGoals?: string;
  technicalRequirements?: string;
  budgetRange?: string;
  timeline?: string;
  teamSize?: string;
  existingTools?: string;
  successMetrics?: string;
  additionalNotes?: string;
}

/** POST /api/checklist — forwards strategic checklist to workspace CRM. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChecklistPayload;

    if (!body.name?.trim() || !body.email?.trim()) {
      return NextResponse.json(
        { message: "Nome e e-mail são obrigatórios." },
        { status: 400 },
      );
    }

    const company = body.company?.trim() || "";
    const message = company
      ? `Checklist preenchido — ${company}`
      : "Checklist preenchido";

    const extraData = {
      locale: "pt",
      country: "BR",
      region: "Brasil",
      site: "innexar.com.br",
      page: "/checklist",
      company: company || undefined,
      currentChallenges: body.currentChallenges || undefined,
      targetAudience: body.targetAudience || undefined,
      businessGoals: body.businessGoals || undefined,
      technicalRequirements: body.technicalRequirements || undefined,
      budgetRange: body.budgetRange || undefined,
      timeline: body.timeline || undefined,
      teamSize: body.teamSize || undefined,
      existingTools: body.existingTools || undefined,
      successMetrics: body.successMetrics || undefined,
      additionalNotes: body.additionalNotes || undefined,
    };

    const backendRes = await fetch(`${getWorkspaceApiUrl()}/api/public/web-to-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Id": "innexar-br",
        Referer: "https://innexar.com.br/checklist",
      },
      body: JSON.stringify({
        name: body.name.trim(),
        email: body.email.trim(),
        phone: body.phone?.trim() || null,
        message,
        source: "website_checklist",
        extra_data: extraData,
      }),
    });

    if (!backendRes.ok) {
      console.error("Checklist web-to-lead error:", backendRes.status, await backendRes.text());
      return NextResponse.json({ message: "Erro ao registrar checklist." }, { status: 502 });
    }

    const lead = (await backendRes.json()) as { id: number };
    return NextResponse.json({ message: "Checklist enviado.", id: lead.id });
  } catch (error) {
    console.error("Checklist submit error:", error);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
