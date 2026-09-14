'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, Search, Filter, ExternalLink } from 'lucide-react'
import { templateRegistry, getCategories } from '@/templates/registry'

export default function TemplateGalleryPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    const categories = getCategories()

    const filteredTemplates = templateRegistry.filter((template) => {
        const matchesSearch =
            template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

        const matchesCategory = !selectedCategory || template.category === selectedCategory

        return matchesSearch && matchesCategory
    })

    return (
        <div className="min-h-screen bg-linear-to-b from-[#f4fbff] via-white to-[#eef7ff] text-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/85 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-950">Template Gallery</h1>
                            <p className="mt-1 text-slate-600">
                                Choose from our professionally designed templates
                            </p>
                        </div>
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-slate-600 transition-colors hover:text-cyan-700"
                        >
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-12">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-5 h-5 text-slate-500" />
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === null
                                    ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-white'
                                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            All
                        </button>
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === category
                                        ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-white'
                                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Template Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredTemplates.map((template, index) => (
                        <motion.div
                            key={template.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:-translate-y-1 hover:border-cyan-300"
                        >
                            {/* Thumbnail */}
                            <div className="relative aspect-[16/10] overflow-hidden">
                                <Image
                                    src={template.thumbnail}
                                    alt={template.name}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 flex items-end justify-center gap-4 bg-gradient-to-t from-slate-950/70 to-transparent pb-6 opacity-0 transition-opacity group-hover:opacity-100">
                                    <Link
                                        href={`/templates/preview/${template.id}`}
                                        className="flex items-center gap-2 rounded-lg bg-linear-to-r from-cyan-500 to-blue-600 px-4 py-2 text-white transition-opacity hover:opacity-95"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Preview
                                    </Link>
                                    <Link
                                        href={`/templates/preview/${template.id}`}
                                        target="_blank"
                                        className="flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-white transition-colors hover:bg-white/25"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Full Screen
                                    </Link>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xl font-bold text-slate-900">{template.name}</h3>
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                        {template.category}
                                    </span>
                                </div>
                                <p className="mb-4 text-sm text-slate-600">{template.description}</p>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-2">
                                    {template.tags.slice(0, 4).map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded bg-cyan-50 px-2 py-1 text-xs text-cyan-700"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* No Results */}
                {filteredTemplates.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-lg text-slate-600">No templates found matching your criteria.</p>
                        <button
                            onClick={() => {
                                setSearchQuery('')
                                setSelectedCategory(null)
                            }}
                            className="mt-4 text-cyan-700 hover:text-cyan-800"
                        >
                            Clear filters
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}
