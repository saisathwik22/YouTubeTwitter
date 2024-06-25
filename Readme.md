# BACKEND of Youtube + Twitter

## Introduction:
This is a Youtube + Twitter backend project that includes key functionalities of youtube and tweet functionality from twitter.

Important Links:

- [API Documentation](https://documenter.getpostman.com/view/28570926/2s9YsNdVwW) (credit : Hruthik-28)
- [Model link](https://app.eraser.io/workspace/YtPqZ1VogxGy1jzIDkzj?origin=share) (credit : chaiaurcode)

## FEATURES:

### User Management:

- Register, login, logout, password reset
- Other details like cover image, avatar management
- watch history tracking

### Video Management:

- Video upload, publishing, editing, deletion, pagination, search and sorting.
- publish/unpublish control

### Tweet Management:

- tweet creation, publishing, updation, deletion, display

### Subscription Management:

- Channel subscriptions
- subscriberes list display, subscribed channels list display

### Playlist Management:

- creation, updation, deletion, viewing

### Like Management:

- liking, unliking videos, comments and tweets , viewing liked videos

### Comment Management:

- adding, updating, deleting

### Dashboard:

- View channel statistics (views, likes, subscribers etc)
- accessing uploaded videos

### Health check:

- endpoint to verify backed's health

## Technologies Used:

- Node.js
- Express.js
- MongoDB
- Cloudinary

## Installation and Setup

1. **Clone the repository:**

    ```bash
    git clone https://github.com/Hruthik-28/youtube-twitter.git
    ```

2. **Install dependencies:**

    ```bash
    cd youtube-twitter
    npm install
    ```

3. **Set up environment variables:**
    Create a .env in root of project and fill in the required values in the .env file using .env.sample file

4. **Start the server:**

    ```bash
    npm run dev
    ```


A big thanks to - [ChaiAurCode](www.youtube.com/@chaiaurcode) and - [Hruthik-KS](https://github.com/Hruthik-28)
