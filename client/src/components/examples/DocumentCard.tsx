import { DocumentCard } from '../DocumentCard';

export default function DocumentCardExample() {
  return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
      <DocumentCard
        id="1"
        name="Financial_Report_Q4_2024.pdf"
        status="liquid"
        fragmentCount={8}
        lastAccessed="2 hours ago"
        size="2.4 MB"
        onView={() => console.log('View clicked')}
        onDownload={() => console.log('Download clicked')}
        onDelete={() => console.log('Delete clicked')}
      />
      <DocumentCard
        id="2"
        name="Product_Specifications.docx"
        status="reconstituted"
        fragmentCount={12}
        lastAccessed="1 day ago"
        size="1.8 MB"
        onView={() => console.log('View clicked')}
        onDownload={() => console.log('Download clicked')}
        onDelete={() => console.log('Delete clicked')}
      />
      <DocumentCard
        id="3"
        name="Strategic_Plan_2025.pdf"
        status="accessible"
        fragmentCount={6}
        lastAccessed="Just now"
        size="3.2 MB"
        onView={() => console.log('View clicked')}
        onDownload={() => console.log('Download clicked')}
        onDelete={() => console.log('Delete clicked')}
      />
    </div>
  );
}
