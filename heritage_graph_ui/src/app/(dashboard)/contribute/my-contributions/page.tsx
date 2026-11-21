import MyContributionsClient from "./page-client";

export const metadata = {
  title: "My Contributions · HeritageGraph",
  description: "Track the status and reviewer feedback of everything you've contributed.",
};

export default function MyContributionsPage() {
  return <MyContributionsClient />;
}
