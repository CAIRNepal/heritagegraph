"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { toast } from "sonner"

export default function ContributePage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)

    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      location: formData.get("location"),
      contributor: formData.get("contributor"),
    }

    try {
      await new Promise((res) => setTimeout(res, 1500))
      toast.success("Thank you for your contribution!")
      router.push("/dashboard")
    } catch (error) {
      toast.error("Failed to submit. Try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
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
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                placeholder="E.g. Kathmandu, Nepal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contributor">Your Name</Label>
              <Input
                id="contributor"
                name="contributor"
                placeholder="Optional"
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Submitting..." : "Submit Contribution"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
