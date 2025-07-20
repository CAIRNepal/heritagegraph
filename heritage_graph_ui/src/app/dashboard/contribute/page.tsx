"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast, Toaster } from "sonner"

export default function ContributePage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { getToken, isSignedIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!isSignedIn) {
      toast.error("You must be signed in to submit.")
      setIsSubmitting(false)
      return
    }

    const form = e.currentTarget
    if (!(form instanceof HTMLFormElement)) {
      toast.error("Form submission error.")
      setIsSubmitting(false)
      return
    }

    const formData = new FormData(form)
    const title = formData.get("title")?.toString().trim() || ""
    const description = formData.get("description")?.toString().trim() || ""

    // Validate non-empty fields
    if (!title || !description) {
      toast.error("Please fill out both the Title and Description fields.")
      setIsSubmitting(false)
      return
    }

    try {
      const token = await getToken()
      if (!token) {
        toast.error("Authentication token not found.")
        setIsSubmitting(false)
        return
      }

      const payload = {
        title,
        description,
        status: "pending",
        created_at: new Date().toISOString(),
      }

      const res = await fetch("http://localhost:8000/data/form-submit/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (res.status === 201 || res.status === 200) {
        toast(
          "Thank you for your contribution!",
          {
            description: `Your entry "${payload.title}" has been submitted successfully.`,
            action: {
              label: "Go to Dashboard",
              onClick: () => router.push("/dashboard"),
            },
          }
        )
      } else if (res.status === 400) {
        const err = await res.json()
        toast.error("Invalid submission: " + (err?.detail || "Check your inputs."))
      } else {
        toast.error("Unexpected error occurred.")
      }
    } catch (error) {
      console.error(error)
      toast.error("Failed to submit. Try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      <section className="px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Submit a Cultural Heritage Entry
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Share a site, object, ritual, or tradition worth preserving.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contribution Form</CardTitle>
            <CardDescription>
              Fill in the details below and help enrich our collective memory.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="E.g. Bhaktapur Durbar Square"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={5}
                  placeholder="Provide a detailed description, history, or significance..."
                  required
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Submitting..." : "Submit Contribution"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
