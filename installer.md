# AWS Infrastructure Installer

boto3를 사용하여 AWS 인프라 리소스를 생성하는 Python 스크립트입니다.  
CDK 스택과 동등한 AWS 인프라를 프로그래밍 방식으로 배포합니다.

## 목차

1. [개요](#개요)
2. [설정값](#설정값)
3. [생성되는 리소스](#생성되는-리소스)
4. [주요 함수](#주요-함수)
5. [실행 방법](#실행-방법)
6. [배포 순서](#배포-순서)

---

## 개요

이 스크립트는 AI 기반 채팅 애플리케이션을 위한 전체 AWS 인프라를 자동으로 생성합니다.

### 주요 특징
- **완전 자동화**: 단일 스크립트로 전체 인프라 배포
- **멱등성**: 이미 존재하는 리소스는 재사용
- **에러 핸들링**: 각 단계별 예외 처리 및 롤백 지원
- **로깅**: 상세한 배포 진행 상황 출력
- **S3 Vectors 기반 RAG**: Bedrock Knowledge Base가 OpenSearch Serverless 대신 S3 Vectors를 벡터 스토어로 사용

---

## 설정값

```python
# 기본 설정
project_name = "sam"           # 프로젝트 이름 (최소 3자)
region = "us-west-2"           # AWS 리전
git_name = "sam-project"       # Git 저장소 이름

# 자동 생성되는 변수
account_id = sts_client.get_caller_identity()["Account"]
bucket_name = f"storage-for-{project_name}-{account_id}-{region}"
vector_bucket_name = f"{project_name}-{account_id}"
vector_index_name = project_name

# 벡터 인덱스 설정
embedding_dimensions = 1024
embedding_data_type = "float32"
distance_metric = "cosine"

# 커스텀 헤더 (CloudFront-ALB 통신용)
custom_header_name = "X-Custom-Header"
custom_header_value = f"{project_name}_12dab15e4s31"
```

---

## 생성되는 리소스

### 1. S3 버킷
- **이름**: `storage-for-{project_name}-{account_id}-{region}`
- **설정**:
  - CORS 활성화 (GET, POST, PUT)
  - 퍼블릭 액세스 차단
  - 버전 관리 Suspended
  - `docs/` 폴더 자동 생성

### 2. IAM 역할

| 역할 | 설명 |
|------|------|
| `role-knowledge-base-for-{project_name}-{region}` | Bedrock Knowledge Base용 역할 (S3 Vectors 접근 포함) |
| `role-agent-for-{project_name}-{region}` | Bedrock Agent용 역할 |
| `role-ec2-for-{project_name}-{region}` | EC2 인스턴스용 역할 |
| `role-agentcore-memory-for-{project_name}-{region}` | AgentCore Memory용 역할 |

> `create_lambda_role()` 함수는 코드에 남아 있으나, 현재 `main()` 배포 흐름에서는 호출되지 않습니다.

### 3. Secrets Manager
- `tavilyapikey-{project_name}`: Tavily API 키 (실행 시 프롬프트로 입력, Enter로 건너뛰기 가능)

### 4. S3 Vectors (벡터 스토어)
- **벡터 버킷**: `{project_name}-{account_id}`
- **인덱스**: `{project_name}` (1024차원, cosine, float32)
- **메타데이터**: Bedrock 필수 키(`AMAZON_BEDROCK_TEXT`, `AMAZON_BEDROCK_METADATA`)를 non-filterable로 설정

### 5. VPC 네트워킹

```
VPC (10.20.0.0/16)
├── Public Subnets (2개 AZ)
│   ├── Internet Gateway 연결
│   └── NAT Gateway 호스팅
├── Private Subnets (2개 AZ)
│   └── NAT Gateway를 통한 아웃바운드
├── Security Groups
│   ├── ALB SG (포트 80)
│   └── EC2 SG (포트 8501, 443)
└── VPC Endpoints
    └── Bedrock Runtime 엔드포인트
```

### 6. Application Load Balancer
- **타입**: Internet-facing Application Load Balancer
- **리스너**: HTTP 포트 80
- **타겟 그룹**: EC2 인스턴스 (포트 8501)

### 7. CloudFront 배포
- **오리진**:
  - 기본: ALB (동적 컨텐츠)
  - `/images/*`, `/docs/*`: S3 (정적 컨텐츠)
- **캐시 정책**: Managed-CachingDisabled
- **프로토콜**: HTTP → HTTPS 리다이렉트

### 8. EC2 인스턴스
- **타입**: t3.medium
- **AMI**: Amazon Linux 2023 ECS Optimized (없으면 일반 AL2023로 폴백)
- **볼륨**: 80GB gp3 (암호화)
- **배포 위치**: Private Subnet
- **User Data**: Git 클론 → Docker 빌드/실행 → `config.json` 마운트

### 9. Bedrock Knowledge Base
- **스토리지**: S3 Vectors (`S3_VECTORS` 타입)
- **임베딩 모델**: Amazon Titan Embed Text v2 (1024차원, FLOAT32)
- **파싱**: 기본 파서 (default parser)
- **청킹**: Fixed Size (300 토큰, 20% 오버랩)
- **데이터 소스**: S3 `docs/` 프리픽스

> `create_opensearch_collection()` 함수는 이전 버전 호환을 위해 코드에 남아 있으나, 현재 배포 흐름에서는 사용하지 않습니다.

---

## 주요 함수

### 인프라 생성 함수

#### `create_s3_bucket()`
S3 버킷 생성 및 CORS, 퍼블릭 액세스 차단 설정

```python
def create_s3_bucket() -> str:
    """Create S3 bucket with CORS configuration."""
    # 버킷 생성
    # CORS 설정 (GET, POST, PUT 허용)
    # 퍼블릭 액세스 차단
    # docs/ 폴더 생성
    return bucket_name
```

#### `create_iam_role()`
IAM 역할 생성 및 관리형 정책 연결

```python
def create_iam_role(role_name: str, assume_role_policy: Dict,
                    managed_policies: Optional[List[str]] = None) -> str:
    """Create IAM role."""
    # 역할 생성
    # Trust Policy 설정
    # 관리형 정책 연결
    return role_arn
```

#### `create_knowledge_base_role()` / `create_agent_role()` / `create_ec2_role()` / `create_agentcore_memory_role()`
각 서비스별 IAM 역할 및 인라인 정책 생성

#### `create_s3_vectors_store()`
S3 Vectors 벡터 버킷 및 인덱스 생성

```python
def create_s3_vectors_store() -> Dict[str, str]:
    """Create S3 vector bucket and index for Bedrock Knowledge Base."""
    # 벡터 버킷 생성
    # 벡터 인덱스 생성 (1024차원, cosine)
    return {
        "vectorBucketName": vector_bucket_name,
        "vectorBucketArn": vector_bucket_arn,
        "indexName": vector_index_name,
        "indexArn": index_arn,
    }
```

#### `create_knowledge_base_with_s3_vectors()`
S3 Vectors를 스토리지로 사용하는 Bedrock Knowledge Base 생성

```python
def create_knowledge_base_with_s3_vectors(
    s3_vectors_info: Dict[str, str],
    knowledge_base_role_arn: str,
    s3_bucket_name: str,
) -> Tuple[str, str]:
    """Create Knowledge Base with S3 Vectors as the vector store."""
    # 기존 KB가 다른 스토리지를 사용하면 삭제 후 재생성
    # Knowledge Base 생성 (Titan Embed v2)
    # S3 데이터 소스 생성 (docs/ 프리픽스)
    return knowledge_base_id, data_source_id
```

#### `create_vpc()`
VPC, 서브넷, 보안 그룹, VPC 엔드포인트 생성

```python
def create_vpc() -> Dict[str, str]:
    """Create VPC with subnets and security groups."""
    # VPC 생성 (DNS 활성화)
    # 퍼블릭/프라이빗 서브넷 생성
    # Internet Gateway, NAT Gateway 생성
    # 보안 그룹 생성
    # Bedrock Runtime VPC 엔드포인트 생성
    return {
        "vpc_id": vpc_id,
        "public_subnets": public_subnets,
        "private_subnets": private_subnets,
        "alb_sg_id": alb_sg_id,
        "ec2_sg_id": ec2_sg_id,
    }
```

#### `create_alb()`
Application Load Balancer 생성

```python
def create_alb(vpc_info: Dict[str, str]) -> Dict[str, str]:
    """Create Application Load Balancer."""
    # 최소 2개 AZ의 퍼블릭 서브넷 검증
    # 보안 그룹 연결
    # Internet-facing ALB 생성
    return {"arn": alb_arn, "dns": alb_dns}
```

#### `create_cloudfront_distribution()`
CloudFront 배포 생성 (ALB + S3 하이브리드)

```python
def create_cloudfront_distribution(alb_info: Dict[str, str],
                                   s3_bucket_name: str) -> Dict[str, str]:
    """Create CloudFront distribution with hybrid ALB + S3 origins."""
    # Origin Access Identity 생성
    # S3 버킷 정책 업데이트
    # CloudFront 배포 생성
    #   - 기본 오리진: ALB
    #   - /images/*, /docs/*: S3
    return {"id": distribution_id, "domain": distribution_domain}
```

#### `create_ec2_instance()`
EC2 인스턴스 생성 및 User Data 스크립트 설정

```python
def create_ec2_instance(
    vpc_info: Dict[str, str],
    ec2_role_arn: str,
    knowledge_base_role_arn: str,
    s3_vectors_info: Dict[str, str],
    s3_bucket_name: str,
    cloudfront_domain: str,
    agentcore_memory_role_arn: str,
    knowledge_base_id: str,
    data_source_id: str = None,
) -> str:
    """Create EC2 instance."""
    # 최신 Amazon Linux 2023 AMI 조회
    # User Data 스크립트 생성 (Docker 설치, 앱 배포)
    # 프라이빗 서브넷에 인스턴스 생성
    return instance_id
```

#### `create_alb_target_group_and_listener()`
ALB 타겟 그룹 생성, EC2 등록, HTTP 리스너 연결

### 헬퍼 함수

| 함수 | 설명 |
|------|------|
| `s3_vectors_bucket_arn()` / `s3_vectors_index_arn()` | S3 Vectors ARN 생성 |
| `attach_inline_policy()` | IAM 역할에 인라인 정책 연결 |
| `create_secrets()` | Secrets Manager 시크릿 생성 |
| `ensure_data_source()` | Knowledge Base S3 데이터 소스 생성/조회 |
| `delete_knowledge_base()` | Knowledge Base 및 데이터 소스 삭제 |
| `create_security_group()` | 보안 그룹 생성 |
| `create_vpc_endpoint()` | VPC 엔드포인트 생성 |
| `create_public_subnets()` / `create_private_subnets()` | 서브넷 생성 |
| `get_or_create_internet_gateway()` / `get_or_create_nat_gateway()` | IGW/NAT Gateway 조회/생성 |
| `classify_subnets()` | 서브넷을 퍼블릭/프라이빗으로 분류 |
| `wait_for_subnet_available()` / `wait_for_nat_gateway()` | 리소스 가용 상태 대기 |
| `get_setup_script()` | EC2 User Data / SSM 설정 스크립트 생성 |
| `run_setup_script_via_ssm()` | SSM Run Command로 설정 스크립트 실행 |
| `check_application_ready()` | CloudFront URL 애플리케이션 준비 상태 확인 |

---

## 실행 방법

### 기본 실행 (전체 인프라 배포)

```bash
python installer.py
```

### 기존 EC2 인스턴스에 설정 스크립트 실행

```bash
# 인스턴스 이름으로 자동 탐색
python installer.py --run-setup

# 특정 인스턴스 ID 지정
python installer.py --run-setup i-1234567890abcdef0
```

`--run-setup`은 `application/config.json`의 설정을 읽어 SSM으로 Docker 앱을 재배포합니다.

### EC2 서브넷 배포 검증

```bash
python installer.py --verify-deployment
```

---

## 배포 순서

스크립트는 다음 순서로 리소스를 생성합니다:

```
[1/10] S3 버킷 생성
       ↓
[2/10] IAM 역할 생성
       • Knowledge Base 역할
       • Agent 역할
       • EC2 역할
       • AgentCore Memory 역할
       ↓
[3/10] Secrets Manager 시크릿 생성
       • Tavily API 키 (선택 입력)
       ↓
[4/10] S3 Vectors 스토어 생성
       • 벡터 버킷 + 인덱스
       ↓
[4.5/10] Bedrock Knowledge Base 생성
       • S3 Vectors 연결
       • S3 데이터 소스 (docs/) 연결
       ↓
[5/10] VPC 네트워킹 리소스 생성
       • VPC, 서브넷 생성
       • IGW, NAT Gateway 생성
       • 보안 그룹 생성
       • Bedrock Runtime VPC 엔드포인트 생성
       ↓
[6/10] Application Load Balancer 생성
       ↓
[7/10] CloudFront 배포 생성
       • OAI 생성
       • S3 버킷 정책 업데이트
       • ALB + S3 하이브리드 오리진
       ↓
[8/10] EC2 인스턴스 생성
       • User Data 스크립트로 Docker 앱 배포
       • 프라이빗 서브넷에 배포
       ↓
[9/10] ALB 타겟 그룹 및 리스너 생성
       • EC2 인스턴스 등록
       • HTTP 리스너 생성
       ↓
[10/10] 애플리케이션 준비 상태 확인
       ↓
완료 - application/config.json 업데이트
```

---

## 배포 완료 후

배포가 완료되면 다음 정보가 출력됩니다:

```
================================================================
Infrastructure Deployment Completed Successfully!
================================================================
Summary:
  S3 Bucket: storage-for-sam-{account_id}-us-west-2
  VPC ID: vpc-xxxxxxxxx
  Public Subnets: subnet-xxx, subnet-yyy
  Private Subnets: subnet-aaa, subnet-bbb
  ALB DNS: http://alb-for-sam-xxxxxx.us-west-2.elb.amazonaws.com/
  CloudFront Domain: https://xxxxxxxxx.cloudfront.net
  EC2 Instance ID: i-xxxxxxxxx (deployed in private subnet)
  S3 Vector Bucket: sam-{account_id}
  S3 Vector Index ARN: arn:aws:s3vectors:...
  Knowledge Base ID: XXXXXXXXXX
  Knowledge Base Role: arn:aws:iam::...
  AgentCore Memory Role: arn:aws:iam::...

Total deployment time: XX.XX minutes
================================================================
```

### application/config.json

배포 성공/실패와 관계없이 `finally` 블록에서 `application/config.json`이 갱신됩니다. 주요 필드:

| 필드 | 설명 |
|------|------|
| `projectName`, `accountId`, `region` | 프로젝트 기본 정보 |
| `knowledge_base_id`, `data_source_id` | Bedrock Knowledge Base |
| `knowledge_base_role`, `agentcore_memory_role` | IAM 역할 ARN |
| `vector_bucket_name`, `vector_bucket_arn` | S3 Vectors 버킷 |
| `vector_index_name`, `vector_index_arn` | S3 Vectors 인덱스 |
| `s3_bucket`, `s3_arn` | 문서 저장 S3 버킷 |
| `sharing_url` | CloudFront URL |
| `collectionArn`, `opensearch_url` | 레거시 호환용 빈 값 |

### Docker Container 구성

EC2에 올라가는 애플리케이션은 Streamlit + Strands Agent 기반이며, 아래 Dockerfile로 빌드됩니다.

```text
FROM --platform=linux/amd64 python:3.13-slim

WORKDIR /app

RUN pip install streamlit==1.41.0 streamlit-chat pandas numpy boto3
RUN pip install langchain_aws langchain langchain_community langchain_experimental langchain-text-splitters
RUN pip install mcp
RUN pip install aioboto3 opensearch-py
RUN pip install tavily-python==0.5.0 pytz==2024.2 beautifulsoup4==4.12.3
RUN pip install plotly_express==0.4.1 matplotlib==3.10.0 pytrials
RUN pip install PyPDF2==3.0.1 requests uv kaleido diagrams arxiv graphviz sarif-om==1.0.4
RUN pip install rich==13.9.0 bedrock-agentcore
RUN pip install strands-agents strands-agents-tools colorama finance-datareader

RUN mkdir -p /root/.streamlit
COPY config.toml /root/.streamlit/

COPY . .

EXPOSE 8501

HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health

ENTRYPOINT ["python", "-m", "streamlit", "run", "application/app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

User Data 스크립트는 GitHub에서 `{git_name}` 저장소를 클론하고, `config.json`을 생성한 뒤 Docker 컨테이너를 실행합니다.

### 주의사항
- CloudFront 배포는 완전히 활성화되기까지 15-20분이 소요될 수 있습니다
- EC2 인스턴스의 User Data 스크립트가 애플리케이션을 설치하고 시작합니다
- `application/config.json` 파일이 자동으로 업데이트됩니다 (부분 배포 시에도 저장)
- Knowledge Base가 기존 OpenSearch Serverless를 사용 중이면 S3 Vectors로 마이그레이션 시 자동 삭제 후 재생성됩니다

---

## 에러 처리

스크립트는 다음과 같은 에러를 자동으로 처리합니다:

| 상황 | 처리 방법 |
|------|----------|
| 리소스 이미 존재 | 기존 리소스 재사용 |
| 서브넷 부족 | 자동으로 서브넷 생성 |
| CIDR 충돌 | 대체 CIDR 블록 자동 선택 |
| 정책 이미 존재 | 기존 정책 업데이트 |
| KB 스토리지 불일치 | Knowledge Base 삭제 후 S3 Vectors로 재생성 |
| 타임아웃 | 재시도 로직 적용 |

배포 실패 시 상세한 에러 메시지와 스택 트레이스가 출력되며, 가능한 배포 정보는 `application/config.json`에 저장됩니다.
