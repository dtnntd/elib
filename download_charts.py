import base64
import requests
import zlib
import os

# Define charts
charts = {
    "chart_borrow.png": """sequenceDiagram
    participant User
    participant API
    participant Inventory
    participant Copy
    participant Loan

    User->>API: 1. Borrow Request (Physical)
    API->>Loan: Check Quota (VIP:10 / Basic:2)
    alt Over Limit
        API-->>User: 403 Forbidden
    else OK
        API->>Copy: 2. FindOneAndUpdate({status: 'AVAILABLE'})
        alt Out of Stock
            API-->>User: 409 Conflict
        else Success
            API->>Inventory: 3. Dec AvailableCopies
            API->>Loan: 4. Create Loan
            API-->>User: 200 OK
        end
    end""",
    
    "chart_license.png": """sequenceDiagram
    participant API
    participant Member
    participant License
    participant Loan

    API->>Member: 1. Check Role & Subcription (VIP/BASIC)
    API->>License: 2. Get License (OCOU / UNLIMITED)
    
    alt Model == UNLIMITED
        API->>Loan: Check VIP Quota (Unlimited vs 5 books)
        API->>Loan: 3a. Create Loan (Instant Access)
        API-->>User: 200 OK (Read Link)
    else Model == OCOU
        API->>Loan: 3b. Count Active Digital Loans
        alt Active >= ConcurrentLimit
            API-->>User: 409 Waitlist / Full
        else Grant Access
            API->>Loan: 4. Create Loan (Type: DIGITAL)
            API-->>User: 200 OK (Read Link)
        end
    end""",

    "chart_vip.png": """sequenceDiagram
    participant API
    participant Member
    participant Transaction

    API->>Member: 1. Check Wallet Balance
    alt Insufficient Funds
        API-->>User: 400 Bad Request
    else Sufficient
        API->>Member: 2. Deduct Balance & Update Role (isVIP=true)
        API->>Transaction: 3. Insert Log (Type: VIP_PURCHASE)
        API-->>User: 200 OK (VIP Active)
    end""",

    "chart_perf_time.png": """%%{init: { "xychart": { "chartOrientation": "vertical" } } }%%
xychart-beta
    title "Thời gian Truy vấn (Thấp hơn là Tốt hơn)"
    x-axis ["Text Index (2ms)", "Regex Scan (24ms)"]
    y-axis "Mili-giây (ms)" 0 --> 30
    bar [2, 24]""",

    "chart_perf_docs.png": """pie
    title Tỷ lệ Quét dữ liệu (Docs Examined)
    "Toàn bộ (Regex)" : 10015
    "Chính xác (Index)" : 2""",

    "chart_failover.png": """flowchart LR
    subgraph S1 [1. Normal]
        N1[HN1: Primary]
        N2[HP1: Secondary]
    end

    subgraph S2 [2. Failover Event]
        C[HN1: CRASHED] -->|Timeout| E[Election: HP1 votes self]
    end

    subgraph S3 [3. Recovery - Under 3s]
        R1[HP1: PRIMARY]
        R2[HN1: Secondary]
    end

    S1 --> S2
    S2 --> S3
    
    style C fill:#f96,stroke:#333
    style R1 fill:#9f9,stroke:#333""",

    "chart_arch.png": """flowchart LR
    User[Clients] --> Web[ReactJS Web]
    Web --> API[Go API Server]
    API -->|MongoDB Protocol| Router[mongos Router :27020]

    Router --> Config[(Config RS)]
    
    subgraph "Data Shards"
        Router --> Shard1[(Shard 1: City RS / Zone)]
        Shard1 --> HN[Node HN1]
        Shard1 --> HP[Node HP1]
        Shard1 --> DN[Node DN1]

        Router --> Shard2[(Shard 2: Extra RS / Hashed)]
        Shard2 --> EX1[Node EX1]
        Shard2 --> EX2[Node EX2]
    end

    style Shard1 fill:#222,stroke:#fff,color:#fff
    style Shard2 fill:#444,stroke:#aaa,color:#fff""",

    "chart_erd.png": """erDiagram
    BRANCHES ||--o{ PHYSICAL_COPIES : owns
    BOOKS ||--o{ PHYSICAL_COPIES : defines
    BOOKS ||--o{ DIGITAL_LICENSES : has_license
    BOOKS ||--o{ INVENTORY : stock_count

    MEMBERS ||--o{ LOANS : makes
    MEMBERS ||--o{ TRANSACTIONS : performs
    
    PHYSICAL_COPIES ||--o{ LOANS : tied_to_physical
    DIGITAL_LICENSES ||--o{ LOANS : tied_to_digital

    MEMBERS {
        string _id
        string branchId "SHARD KEY"
        object subscription "VIP Info"
        int walletBalance
    }
    INVENTORY {
        string _id
        string bookId
        int availableCopies
    }
    PHYSICAL_COPIES {
        string _id
        string barcode
        string status
    }
    DIGITAL_LICENSES {
        string _id
        string accessModel "OCOU/UNLIMITED"
        int concurrentLimit
    }"""
}

# Kroki.io: https://kroki.io/mermaid/png/<payload>
# Payload = base64url(zlib.compress(utf-8 string))

for filename, content in charts.items():
    print(f"Processing {filename}...")
    
    # 1. Compress and Encode
    compressed = zlib.compress(content.encode('utf-8'))
    payload = base64.urlsafe_b64encode(compressed).decode('utf-8')
    
    # 2. Construct URL
    url = f"https://kroki.io/mermaid/png/{payload}"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            filepath = os.path.join("docs/img", filename)
            with open(filepath, 'wb') as f:
                f.write(response.content)
            print(f"Saved {filepath}")
        else:
            print(f"Failed to download {filename}: {response.status_code}")
    except Exception as e:
        print(f"Error downloading {filename}: {e}")

