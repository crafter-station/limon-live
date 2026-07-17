import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantSite } from "@/components/restaurant-site";
import { storedRestaurantSchema } from "@/domain/restaurant";
import { DrizzleGenerationRepository } from "@/server/db/generation-repository";

export const metadata: Metadata = {
  title: "Restaurante en Perú | Limon",
  description:
    "Información pública de un restaurante en Perú, presentada por Limon.",
  robots: { index: false, follow: false },
};

export default async function PublishedRestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const generation = await new DrizzleGenerationRepository().findReadyBySlug(
    slug,
  );

  if (!generation?.publishedData) notFound();

  const restaurant = storedRestaurantSchema.parse(generation.publishedData);
  return (
    <RestaurantSite
      restaurant={restaurant}
      slug={slug}
      menu={generation.menuStatus === "published" ? generation.menuData : null}
    />
  );
}
