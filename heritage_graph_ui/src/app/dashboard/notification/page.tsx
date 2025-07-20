"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BellIcon } from "lucide-react";

const notifications = [
  {
    id: 1,
    title: "New submission received",
    message: "Alice just submitted a form for review.",
    avatar: "/cair-logo/nabin.jpeg",
    time: "2m ago",
    type: "form",
  },
  {
    id: 2,
    title: "Leaderboard updated",
    message: "Charlie moved up to #3 on the leaderboard.",
    avatar: "/cair-logo/niraj.jpeg",
    time: "15m ago",
    type: "rank",
  },
  {
    id: 3,
    title: "System update",
    message: "Maintenance scheduled for this weekend.",
    avatar: "",
    time: "1h ago",
    type: "system",
  },
  {
    id: 4,
    title: "Message from moderator",
    message: "Your submission was approved. Great job!",
    avatar: "/cair-logo/nabin.jpeg",
    time: "3h ago",
    type: "approval",
  },
];

export default function NotificationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-6 sm:p-12">
      <main className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-sky-500 rounded-full text-white">
              <BellIcon className="w-5 h-5" />
            </div>
            Notifications
          </h1>
        </div>
        
        <Card className="bg-white/80 backdrop-blur-sm border border-blue-200 shadow-lg rounded-xl">
          <CardHeader className="border-b border-blue-200">
            <CardTitle className="text-lg sm:text-xl text-blue-900">
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <ul className="divide-y divide-blue-200/50">
                {notifications.map(({ id, title, message, avatar, time, type }) => (
                  <li
                    key={id}
                    className="p-4 hover:bg-blue-50/50 transition-colors duration-200"
                  >
                    <div className="flex gap-4 items-start">
                      <Avatar className="mt-1 border-2 border-blue-200">
                        {avatar ? (
                          <AvatarImage src={avatar} alt={title} />
                        ) : (
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            <BellIcon className="w-4 h-4" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-blue-900 leading-tight">{title}</h3>
                          <span className="text-xs text-blue-600/80">{time}</span>
                        </div>
                        <p className="text-sm text-blue-700 mt-1">{message}</p>
                        <Badge 
                          variant="outline" 
                          className="mt-2 border-blue-200 text-blue-600"
                        >
                          {type}
                        </Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}