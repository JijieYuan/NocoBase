import requests
import json

# 配置参数
BASE_URL = "http://localhost:13000/api/check_records:create"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVOYW1lIjoicm9vdCIsImlhdCI6MTc3MDM0ODkyNywiZXhwIjozMzMyNzk0ODkyN30.kmfrAvqjFDNvsWnRa1nU-Qe09BHbzKnarYj2qzxhkBE"  # 填入你之前生成的密钥

# 模拟一条 GitLab 走查数据
mock_data = {
    "commit_id": "feat-2026-001",
    "author_id": 1,  # 对应你修改后的 author_id 外键
    "ci_report": {   # 这部分会自动存入你配置的 JSONB 字段
        "status": "passed",
        "score": 88.5,
        "details": "Initial migration test"
    }
}

# 发送请求
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}


try:
    response = requests.post(BASE_URL, headers=headers, json=mock_data)
    
    if response.status_code == 200:
        print("成功！数据已存入数据库，请刷新网页查看。")
    elif "duplicated" in response.text:
        print("拦截成功：commit_id 已存在，触发了你配置的唯一性约束。")
    else:
        print(f"失败：{response.text}")
except Exception as e:
    print(f"连接失败，请确保 yarn dev 正在运行：{e}")