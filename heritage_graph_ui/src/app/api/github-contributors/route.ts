import { NextResponse } from 'next/server';

export const revalidate = 3600; // cache for 1 hour

export async function GET() {
  try {
    const res = await fetch(
      'https://api.github.com/repos/CAIRNepal/heritagegraph/contributors',
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          // Add a token via env var if you hit rate limits:
          // Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub API responded with ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch contributors' },
      { status: 500 }
    );
  }
}
