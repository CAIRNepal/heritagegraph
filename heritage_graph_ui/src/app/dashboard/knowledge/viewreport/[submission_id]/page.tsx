"use client"

import { useEffect, useState } from "react"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Submission {
  [key: string]: any
}

const SHOWN_KEYS = [
  "submission_id",
  "title",
  "description",
  "contributor_username",
  "status",
  "created_at",
  "Activity",
  "Monument_name",
  "Monument_type",
  "Province_number"
]

export default function SubmissionPage({ params }: { params: { submission_id: string } }) {
  const [submission, setSubmission] = useState<Submission | null>(null)

  useEffect(() => {
    fetch(`http://localhost:8000/data/submissions/${params.submission_id}/`)
      .then((res) => res.json())
      .then(setSubmission)
      .catch(console.error)
  }, [params.submission_id])

  if (!submission) return <p>Loading...</p>

  // Filter out keys that are already displayed
  const remainingFields = Object.entries(submission).filter(
    ([key]) => !SHOWN_KEYS.includes(key)
  )

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Main card */}
      <Card>
        <CardHeader>
          <CardTitle>{submission.title}</CardTitle>
          <CardDescription>
            Submission ID: {submission.submission_id} | Contributor: {submission.contributor_username} | Status: {submission.status}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{submission.description}</p>
          {submission.Monument_name && (
            <div>
              <h3 className="font-medium">Monument Name</h3>
              <p>{submission.Monument_name}</p>
            </div>
          )}
          {submission.Activity && (
            <div>
              <h3 className="font-medium">Activity</h3>
              <p>{submission.Activity}</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline">Edit / View More</Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Remaining fields */}
      {remainingFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Other Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              {remainingFields.map(([key, value]) => (
                <li key={key}>
                  <span className="font-medium">{key.replace(/_/g, " ")}:</span>{" "}
                  <span>{value ? value.toString() : "N/A"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
