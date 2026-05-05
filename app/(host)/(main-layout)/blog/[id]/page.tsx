import Cta from "@/components/home/Cta";
import BlogDetails from "@/components/pages/BlogDetails";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
import { blogPosts } from "@/public/data/blogs";
export async function generateStaticParams() {
  return blogPosts.map((blog) => ({
    id: blog.id.toString(),
  }));
}
const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Blog Details" />
      <BlogDetails />
      <Cta />
    </main>
  );
};

export default page;
