'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'
import { useTranslations } from 'next-intl'

export type TestimonialItem = {
    name: string
    business: string
    location?: string
    text: string
    rating: number
}

type Props = {
    testimonials: TestimonialItem[]
}

export default function LaunchTestimonials({ testimonials }: Props) {
    const t = useTranslations('launch.testimonials')

    return (
        <section className="relative z-10 py-24">
            <div className="container mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <span className="inline-flex items-center gap-2 px-4 py-1 bg-yellow-50 border border-yellow-300 rounded-full text-yellow-800 text-sm mb-4">
                        <Star className="w-4 h-4 fill-yellow-400" />
                        Customer Reviews
                    </span>
                    <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900">{t('title')}</h2>
                    <p className="text-slate-700 max-w-2xl mx-auto">{t('subtitle')}</p>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {testimonials.map((review, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="relative rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-cyan-300 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.5)]"
                        >
                            <Quote className="absolute top-4 right-4 w-8 h-8 text-slate-200" />
                            <div className="flex items-center gap-1 mb-4">
                                {[...Array(review.rating)].map((_, j) => (
                                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                ))}
                            </div>
                            <p className="mb-6 leading-relaxed text-slate-700">&quot;{review.text}&quot;</p>
                            <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-sm shrink-0">
                                    {review.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-semibold text-slate-900 text-sm truncate">{review.name}</div>
                                    <div className="text-xs text-slate-600 truncate">{review.business}</div>
                                    {review.location && (
                                        <div className="text-xs text-slate-500 truncate">{review.location}</div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
