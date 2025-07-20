"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

const leaderboardData = [
  { rank: 1, name: "Nabin", avatar: "/avatars/nabin.png", country: "🇳🇵", institution: "Sunway College Kathmandu", score: 980 },
  { rank: 2, name: "Bob", avatar: "/avatars/bob.png", country: "🇺🇸", institution: "MIT", score: 920 },
  { rank: 3, name: "Charlie", avatar: "/avatars/charlie.png", country: "🇬🇧", institution: "Oxford", score: 870 },
  { rank: 4, name: "Dana", avatar: "/avatars/dana.png", country: "🇩🇪", institution: "TUM", score: 840 },
  { rank: 5, name: "Eli", avatar: "/avatars/eli.png", country: "🇮🇳", institution: "IIT Delhi", score: 800 },
  { rank: 6, name: "Alice", avatar: "/avatars/alice.png", country: "🇳🇵", institution: "TU", score: 980 },

];

const ITEMS_PER_PAGE = 3;

export default function LeaderboardPage() {
  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("all"); // Use "all" instead of empty string
  const [page, setPage] = useState(1);

  const filteredData = useMemo(() => {
    return leaderboardData.filter((entry) => {
      const matchesQuery = entry.name.toLowerCase().includes(query.toLowerCase());
      const matchesInstitution = institutionFilter === "all" || institutionFilter === "" ? true : entry.institution === institutionFilter;
      return matchesQuery && matchesInstitution;
    });
  }, [query, institutionFilter]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

  return (
    <div className="font-sans min-h-screen p-6 sm:p-12 bg-background text-foreground">
      <main className="max-w-5xl mx-auto flex flex-col gap-10">
        <div className="flex items-center justify-between">
          <Image
            className="dark:invert"
            src="/cair-logo/fulllogo_nobuffer.png"
            alt="CAIR-Nepal logo"
            width={180}
            height={38}
            priority
          />
          <h1 className="text-2xl sm:text-3xl font-bold">Leaderboard</h1>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Input
            placeholder="Search by name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={institutionFilter}
            onValueChange={(value) => {
              setInstitutionFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Institution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Institutions</SelectItem>
              {[...new Set(leaderboardData.map((d) => d.institution))].map((inst) => (
                <SelectItem key={inst} value={inst}>
                  {inst}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="w-full shadow-md border border-border">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Top Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Institution</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Country</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((entry) => (
                  <TableRow
                    key={entry.rank}
                    className={cn(
                      "hover:bg-muted/60",
                      entry.rank === 1 && "bg-yellow-100/60 dark:bg-yellow-900/20",
                      entry.rank === 2 && "bg-gray-100 dark:bg-gray-800/20",
                      entry.rank === 3 && "bg-amber-50 dark:bg-amber-900/20"
                    )}
                  >
                    <TableCell className="font-semibold text-muted-foreground">
                      #{entry.rank}
                    </TableCell>
                    <TableCell className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={entry.avatar} alt={entry.name} />
                        <AvatarFallback>
                          {entry.name.split(" ").map((w) => w[0]).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{entry.name}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{entry.institution}</TableCell>
                    <TableCell className="hidden sm:table-cell text-center text-xl">{entry.country}</TableCell>
                    <TableCell className="text-right font-semibold">{entry.score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                      aria-disabled={page === 1}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm text-muted-foreground px-3">
                      Page {page} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                      aria-disabled={page === totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}