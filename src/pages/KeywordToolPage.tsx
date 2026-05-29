import Layout from '../components/Layout';
import Header from '../components/Header';
import KeywordTool from '../components/KeywordTool';

export default function KeywordToolPage() {
  return (
    <Layout>
      <Header title="키워드 조회" subtitle="네이버 키워드의 PC·모바일 월간 검색수와 연관 키워드를 조회합니다" />
      <div className="flex-1 p-6">
        <KeywordTool />
      </div>
    </Layout>
  );
}
