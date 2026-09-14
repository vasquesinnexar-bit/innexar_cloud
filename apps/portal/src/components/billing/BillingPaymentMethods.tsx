"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  CreditCard,
  Plus,
  Trash2,
  Star,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useWorkspaceApi, workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";
import Modal from "@/components/Modal";

interface SavedCard {
  id: string | number;
  last_four: string;
  brand: string;
  holder_name: string;
  expiry_month: number;
  expiry_year: number;
  is_default: boolean;
}

const brandColors: Record<string, string> = {
  visa: "from-blue-600 to-blue-800",
  mastercard: "from-orange-500 to-red-600",
  amex: "from-blue-400 to-blue-600",
  elo: "from-yellow-400 to-orange-500",
  hipercard: "from-red-500 to-red-700",
  default: "from-gray-500 to-gray-700",
};

function getBrandColor(brand: string): string {
  const key = brand.toLowerCase();
  return brandColors[key] || brandColors.default;
}

export function BillingPaymentMethods() {
  const t = useTranslations("billingPage");
  const isWorkspaceApi = useWorkspaceApi();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasApi, setHasApi] = useState<boolean | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [cardError, setCardError] = useState("");
  const [cardSuccess, setCardSuccess] = useState("");
  const [removingId, setRemovingId] = useState<string | number | null>(null);

  // New card form state
  const [formCardNumber, setFormCardNumber] = useState("");
  const [formCardName, setFormCardName] = useState("");
  const [formCardExpiry, setFormCardExpiry] = useState("");
  const [formCardCvv, setFormCardCvv] = useState("");

  const fetchCards = useCallback(async () => {
    const token = getCustomerToken();
    if (!token || !isWorkspaceApi) {
      setLoading(false);
      setHasApi(false);
      return;
    }
    try {
      const res = await workspaceFetch(API_PATHS.PAYMENT_METHODS.LIST, { token });
      if (res.ok) {
        const data = await res.json();
        setCards(Array.isArray(data) ? data : []);
        setHasApi(true);
      } else if (res.status === 404) {
        setHasApi(false);
      } else {
        setHasApi(false);
      }
    } catch {
      setHasApi(false);
    } finally {
      setLoading(false);
    }
  }, [isWorkspaceApi]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardError("");
    setCardSuccess("");
    setSavingCard(true);
    const token = getCustomerToken();
    if (!token) {
      setCardError("Session expired. Please login again.");
      setSavingCard(false);
      return;
    }
    try {
      const [expMonth, expYear] = formCardExpiry.split("/").map((s) => s.trim());
      const res = await workspaceFetch(API_PATHS.PAYMENT_METHODS.CREATE, {
        method: "POST",
        token,
        body: JSON.stringify({
          card_number: formCardNumber.replace(/\s/g, ""),
          holder_name: formCardName,
          expiry_month: parseInt(expMonth, 10),
          expiry_year: parseInt(expYear, 10),
          cvv: formCardCvv,
        }),
      });
      if (res.ok) {
        setCardSuccess(t("cardSaved"));
        setFormCardNumber("");
        setFormCardName("");
        setFormCardExpiry("");
        setFormCardCvv("");
        setModalOpen(false);
        fetchCards();
      } else {
        const data = await res.json().catch(() => ({}));
        setCardError(
          typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : "Error saving card"
        );
      }
    } catch {
      setCardError("Connection error.");
    } finally {
      setSavingCard(false);
    }
  };

  const handleRemoveCard = async (id: string | number) => {
    setRemovingId(id);
    const token = getCustomerToken();
    if (!token) return;
    try {
      const res = await workspaceFetch(API_PATHS.PAYMENT_METHODS.DELETE(id), {
        method: "DELETE",
        token,
      });
      if (res.ok) {
        setCardSuccess(t("cardRemoved"));
        setCards((prev) => prev.filter((c) => c.id !== id));
        setTimeout(() => setCardSuccess(""), 3000);
      }
    } catch {
      // ignore
    } finally {
      setRemovingId(null);
    }
  };

  const handleSetDefault = async (id: string | number) => {
    const token = getCustomerToken();
    if (!token) return;
    try {
      const res = await workspaceFetch(API_PATHS.PAYMENT_METHODS.SET_DEFAULT(id), {
        method: "PATCH",
        token,
      });
      if (res.ok) {
        setCards((prev) =>
          prev.map((c) => ({ ...c, is_default: c.id === id }))
        );
      }
    } catch {
      // ignore
    }
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  // --- FALLBACK: show informative static UI when no API ---
  if (!isWorkspaceApi || hasApi === false) {
    if (loading) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-6 shadow-md"
        >
          <h2 className="text-lg font-bold text-theme-primary mb-4">{t("paymentMethodsTitle")}</h2>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-6 shadow-md"
      >
        <h2 className="text-lg font-bold text-theme-primary mb-4">{t("paymentMethodsTitle")}</h2>
        <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-black/[0.03]">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-theme-primary font-medium">{t("cardTitle")}</p>
            <p className="text-theme-secondary text-sm">{t("paymentMethodInfo")}</p>
          </div>
        </div>
        <div className="mt-4">
          <a
            href={API_PATHS.INVOICES.LIST.replace("/invoices", "/payment-methods")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <CreditCard className="w-4 h-4" />
            {t("paymentMethodLink")}
          </a>
        </div>
      </motion.div>
    );
  }

  // --- FULL CARD MANAGEMENT UI ---
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-6 shadow-md"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-theme-primary">{t("paymentMethodsTitle")}</h2>
        <button
          type="button"
          onClick={() => {
            setCardError("");
            setCardSuccess("");
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          {t("addCard")}
        </button>
      </div>

      {cardSuccess && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {cardSuccess}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : cards.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-theme-secondary">{t("noCards")}</p>
          <p className="text-theme-muted text-sm mt-1">{t("cardPlaceholder")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-4 p-4 rounded-xl border ${
                card.is_default
                  ? "border-blue-500/40 bg-blue-500/5"
                  : "border-[var(--border)] bg-black/[0.03]"
              }`}
            >
              <div
                className={`w-12 h-8 rounded-lg bg-gradient-to-br ${getBrandColor(card.brand)} flex items-center justify-center flex-shrink-0`}
              >
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-theme-primary font-medium truncate">
                  {t("cardBrand", { brand: card.brand })}
                </p>
                <p className="text-theme-secondary text-sm">
                  {t("cardLastFour", { lastFour: card.last_four })}
                  <span className="mx-1">&middot;</span>
                  {String(card.expiry_month).padStart(2, "0")}/{card.expiry_year}
                </p>
                {card.is_default && (
                  <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-blue-400">
                    <Star className="w-3 h-3" />
                    {t("defaultCard")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!card.is_default && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(card.id)}
                    className="p-2 rounded-lg text-theme-muted hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    title={t("setAsDefault")}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveCard(card.id)}
                  disabled={removingId === card.id}
                  className="p-2 rounded-lg text-theme-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title={t("removeCard")}
                >
                  {removingId === card.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Card Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("addCard")}
        size="sm"
      >
        <form onSubmit={handleAddCard} className="space-y-4">
          {cardError && (
            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {cardError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1.5">
              {t("cardNumber")}
            </label>
            <input
              type="text"
              value={formCardNumber}
              onChange={(e) => setFormCardNumber(formatCardNumber(e.target.value))}
              placeholder="1234 5678 9012 3456"
              required
              className="w-full px-4 py-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl text-theme-primary placeholder-theme-muted focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1.5">
              {t("cardName")}
            </label>
            <input
              type="text"
              value={formCardName}
              onChange={(e) => setFormCardName(e.target.value)}
              placeholder="JOHN DOE"
              required
              className="w-full px-4 py-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl text-theme-primary placeholder-theme-muted focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1.5">
                {t("cardExpiry")}
              </label>
              <input
                type="text"
                value={formCardExpiry}
                onChange={(e) => setFormCardExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                required
                className="w-full px-4 py-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl text-theme-primary placeholder-theme-muted focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1.5">
                {t("cardCvv")}
              </label>
              <input
                type="text"
                value={formCardCvv}
                onChange={(e) => setFormCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                required
                className="w-full px-4 py-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl text-theme-primary placeholder-theme-muted focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] text-theme-secondary font-medium hover:bg-[var(--border)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingCard}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingCard ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t("addCard")}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
