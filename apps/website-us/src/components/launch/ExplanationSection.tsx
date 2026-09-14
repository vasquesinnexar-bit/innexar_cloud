'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { AlertCircle, Lightbulb } from 'lucide-react'

export default function ExplanationSection() {
    const t = useTranslations('launch.explanation')

    return (
        <section className="relative z-10 py-24">
            <div className="container mx-auto px-6 max-w-4xl">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">{t('title')}</h2>
                    <p className="text-cyan-700 text-lg">{t('subtitle')}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="grid md:grid-cols-2 gap-8"
                >
                    <div className="flex gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.5)]">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-6 h-6 text-amber-700" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('problemLabel')}</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">{t('problem')}</p>
                        </div>
                    </div>
                    <div className="flex gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.5)]">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                            <Lightbulb className="w-6 h-6 text-emerald-700" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('solutionLabel')}</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">{t('solution')}</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
