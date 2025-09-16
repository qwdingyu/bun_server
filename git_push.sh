#!/bin/bash

# GitHub 项目上传脚本

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 错误处理函数
error_exit() {
    echo -e "${RED}错误: $1${NC}" >&2
    exit 1
}

# 检查是否安装了 GitHub CLI
if ! command -v gh &> /dev/null; then
    error_exit "未找到 GitHub CLI (gh)，请先安装: https://cli.github.com"
fi

# 检查是否在 Git 仓库中
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${YELLOW}当前目录不是 Git 仓库，正在初始化...${NC}"
    git init || error_exit "Git 初始化失败"
    git add . || error_exit "添加文件到暂存区失败"
    read -p "请输入初始提交信息: " commit_msg
    git commit -m "${commit_msg:-初始提交}" || error_exit "初始提交失败"
fi

# 获取当前目录名作为项目名
project_name=$(basename "$PWD")

# 检查 GitHub 上是否已存在项目
echo -e "${YELLOW}检查 GitHub 上是否已存在项目 '$project_name'...${NC}"

if gh repo view "$project_name" > /dev/null 2>&1; then
    echo -e "${GREEN}项目已存在，准备推送代码...${NC}"
    
    # 检查是否已设置远程仓库
    if ! git remote | grep -q origin; then
        # 添加远程仓库
        git remote add origin "https://github.com/$(gh api user --jq .login)/$project_name.git" || \
        error_exit "添加远程仓库失败"
    fi
    
    # 推送到 GitHub
    git push -u origin main || git push -u origin master || \
    error_exit "推送代码失败，请检查分支名称"
else
    echo -e "${YELLOW}项目不存在，准备创建新仓库...${NC}"
    
    # 创建新仓库
    read -p "请输入项目描述 (可选): " description
    read -p "设置仓库为公开吗? (y/n, 默认为 n): " is_public
    
    if [[ "$is_public" == "y" || "$is_public" == "Y" ]]; then
        visibility="--public"
    else
        visibility="--private"
    fi
    
    # 创建 GitHub 仓库
    gh repo create "$project_name" --description "$description" $visibility --confirm || \
    error_exit "创建仓库失败"
    
    # 添加远程仓库并推送
    git remote add origin "https://github.com/$(gh api user --jq .login)/$project_name.git" || \
    error_exit "添加远程仓库失败"
    
    # 获取当前分支名称
    branch_name=$(git symbolic-ref --short HEAD)
    git push -u origin "$branch_name" || error_exit "推送代码失败"
fi

echo -e "${GREEN}完成! 项目已成功上传到 GitHub.${NC}"