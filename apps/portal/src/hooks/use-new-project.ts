import { useState, useCallback } from "react";
import { useWorkspaceApi, workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";

export function useNewProject() {
  const isWorkspaceApi = useWorkspaceApi();
  const [step, setStep] = useState(1);
  const [projectType, setProjectType] = useState("");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setFormError(null);
      try {
        if (!isWorkspaceApi) {
          setFormError("Portal sem conexão com a API. Tente novamente.");
          setSubmitting(false);
          return;
        }
        const token = getCustomerToken();
        if (!token) {
          setFormError("Sessão expirada. Faça login novamente.");
          setSubmitting(false);
          return;
        }
        const response = await workspaceFetch(API_PATHS.NEW_PROJECT, {
          method: "POST",
          token,
          body: JSON.stringify({
            project_name: projectName,
            project_type: projectType,
            description: description || undefined,
            budget: budget || undefined,
            timeline: timeline || undefined,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setFormError(
            `Erro ao enviar: ${typeof data.detail === "string" ? data.detail : "tente novamente"}`
          );
          setSubmitting(false);
          return;
        }
        setSubmitted(true);
      } catch {
        setFormError("Erro de conexão. Tente novamente.");
      } finally {
        setSubmitting(false);
      }
    },
    [isWorkspaceApi, projectName, projectType, description, budget, timeline]
  );

  return {
    step,
    setStep,
    projectType,
    setProjectType,
    projectName,
    setProjectName,
    description,
    setDescription,
    budget,
    setBudget,
    timeline,
    setTimeline,
    submitting,
    submitted,
    formError,
    handleSubmit,
  };
}
