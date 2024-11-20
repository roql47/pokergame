// 사용자별 호감도 관리
var userFavorability = {}; // 사용자별 호감도 객체
var blockedUsers = []; // 차단된 사용자 리스트
var responseEnabled = true; // 응답 활성화 여부
var loanData = {}; // 대출 데이터
var bombPoints = 0; // 폭탄 포인트
var lastPokerGameTime = {}; // 마지막 포커게임 참여 시간
var userSeotdaData = {}; // 사용자 섯다 데이터
var lastApartmentGameTime = {}; // 마지막 아파트게임 참여 시간
var remainingLotteryTickets = 0; // 남은 복권 수

// 사용자별 명령어 쿨타임 관리
var commandCooldowns = {}; // 사용자별 명령어 쿨타임 저장

// 사용자별 게임 통계 객체
var userStatistics = {}; // 사용자별 게임 통계

// 포커게임의 족보 정의
var pokerHands = [
    { name: "로얄스트레이트 플러시", rank: 1, reward: 100000 },
    { name: "백스트레이트", rank: 2, reward: 18000 },
    { name: "마운틴", rank: 3, reward: 28000 },
    { name: "스트레이트 플러시", rank: 4, reward: 50000 },
    { name: "포카드", rank: 5, reward: 40000 },
    { name: "풀 하우스", rank: 6, reward: 18000 },
    { name: "플러시", rank: 7, reward: 22222 },
    { name: "스트레이트", rank: 8, reward: 8000 },
    { name: "트리플", rank: 9, reward: 5000 },
    { name: "투 페어", rank: 10, reward: 3000 },
    { name: "원 페어", rank: 11, reward: 1000 },
    { name: "하이 카드", rank: 12, reward: 0 }
];

// 카드 아이콘 정의
var suits = {
    "하트": "♥", // 하트 아이콘
    "클로버": "♣", // 클로버 아이콘
    "스페이드": "♠", // 스페이드 아이콘
    "다이아몬드": "♦" // 다이아몬드 아이콘
};

// 포커 카드 덱 생성 (7~A, 하트, 클로버, 스페이드, 다이아몬드)
function createPokerDeck() {
    var deck = [];
    var ranks = ["7", "8", "9", "10", "J", "Q", "K", "A"]; // 카드 값 수정
    
    for (var suit in suits) {
        for (var i = 0; i < ranks.length; i++) {
            deck.push(suits[suit] + " " + ranks[i]); // 카드 조합 (아이콘 먼저)
        }
    }
    return deck;
}

// 덱 섞기 (피셔-예이츠 셔플)
function shuffleDeck(deck) {
    for (var i = deck.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = deck[i];
        deck[i] = deck[j];
        deck[j] = temp;
    }
    return deck;
}

// 패의 족보 평가
function evaluatePokerHand(hand) {
    var ranks = [];
    for (var i = 0; i < hand.length; i++) {
        ranks.push(hand[i].split(" ")[1]); // 카드의 값만 추출
    }

    var rankCounts = {};
    for (var j = 0; j < ranks.length; j++) {
        rankCounts[ranks[j]] = (rankCounts[ranks[j]] || 0) + 1; // 각 랭크의 개수 세기
    }

    var uniqueRanks = [];
    for (var rank in rankCounts) {
        uniqueRanks.push(rank);
    }
    
    var counts = [];
    for (var count in rankCounts) {
        counts.push(rankCounts[count]);
    }

    var isFlush = true;
    for (var k = 1; k < hand.length; k++) {
        if (hand[k].split(" ")[0] !== hand[0].split(" ")[0]) {
            isFlush = false; // 카드의 무늬가 모두 같은지 확인
            break;
        }
    }

    var isStraight = uniqueRanks.length === 5 && (Math.max.apply(null, ranks) - Math.min.apply(null, ranks) === 4); // 값 차이 확인

    // 족보 판별 순서 변경
    if (isFlush && isStraight && uniqueRanks.indexOf("10") !== -1) return "로얄스트레이트 플러시";
    if (isFlush && isStraight) return "스트레이트 플러시";
    if (counts.indexOf(4) !== -1) return "포카드"; // 4장 동일
    if (counts.indexOf(3) !== -1 && counts.indexOf(2) !== -1) return "풀 하우스"; // 트리플과 페어
    if (counts.indexOf(3) !== -1) return "트리플"; // 트리플
    if (isFlush) return "플러시";
    if (isStraight) return "스트레이트";
    
    var pairCount = 0;
    for (var m = 0; m < counts.length; m++) {
        if (counts[m] === 2) {
            pairCount++;
        }
    }
    if (pairCount === 2) return "투 페어"; // 두 개의 페어
    if (pairCount === 1) return "원 페어"; // 하나의 페어
    return "하이 카드";
}

// 포커게임 실행
function pokerGame(sender) {
    var currentTime = new Date().getTime(); // 현재 시간
    var cooldownTime = 60 * 1000; // 1분 (60초)

    // 쿨타임 체크
    if (commandCooldowns[sender] && (currentTime - commandCooldowns[sender]) < cooldownTime) {
        var remainingTime = Math.ceil((cooldownTime - (currentTime - commandCooldowns[sender])) / 1000);
        return "포커게임을할 수 없습니다. 쿨타임이 남아 있습니다. 남은 시간: " + remainingTime + "초";
    }

    // 쿨타임 갱신
    commandCooldowns[sender] = currentTime;

    load(); // 최신 데이터 로드

    if (blockedUsers.indexOf(sender) !== -1) {
        return "차단된 사용자입니다. 명령어를 사용할 수 없습니다.";
    }

    var currentFavorability = userFavorability[sender] || 0;
    if (currentFavorability < 1000) {
        return "호감도가 부족합니다. 포커게임을 하려면 최소 1000호감도가 필요합니다.";
    }

    // 사용자 호감도 차감
    userFavorability[sender] -= 1000;

    var deck = shuffleDeck(createPokerDeck());
    var playerHand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()]; // 5장 받기

    var handRank = evaluatePokerHand(playerHand);
    var reward = 0;

    // 보상 결정
    for (var i = 0; i < pokerHands.length; i++) {
        if (pokerHands[i].name === handRank) {
            reward = pokerHands[i].reward; // 보상 설정
            break;
        }
    }

    // 사용자 호감도 업데이트 (보상 추가)
    userFavorability[sender] += reward; // 보상으로 호감도 증가
    if (userFavorability[sender] > 1000000) {
        userFavorability[sender] = 1000000;
    }

    // 게임 통계 업데이트
    updateGameStatistics(sender, reward);

    // 데이터 저장
    save(); // 저장 호출 위치를 호감도 업데이트 이후로 변경

    // 결과 메시지 (더 멋지게 꾸미기)
    var resultMessage = "🎉 포커게임 결과 🎉\n" +
                        "-------------------------------------\n" +
                        sender + "님이 카드를 받았습니다:\n" +
                        playerHand.join(", ") + "\n\n" +
                        "🏆 족보: **" + handRank + "**\n" +
                        "💰 보상: " + reward + " 호감도\n" +
                        "-------------------------------------\n";
    return resultMessage;
}

// 게임 통계 업데이트 함수
function updateGameStatistics(user, reward) {
    if (!userStatistics[user]) {
        userStatistics[user] = {
            gamesPlayed: 0,
            totalReward: 0,
            maxReward: 0
        };
    }

    userStatistics[user].gamesPlayed++;
    userStatistics[user].totalReward += reward;
    if (reward > userStatistics[user].maxReward) {
        userStatistics[user].maxReward = reward;
    }
}

// 데이터 저장 함수
function save() {
    var saveData = {
        userFavorability: userFavorability,
        blockedUsers: blockedUsers,
        responseEnabled: responseEnabled,
        userSeotdaData: userSeotdaData, // 사용자 섯다 데이터 저장
        loanData: loanData, // 대출 데이터 저장
        bombPoints: bombPoints, // 폭탄 포인트 저장
        lastApartmentGameTime: lastApartmentGameTime, // 마지막 아파트게임 참여 시간 저장
        remainingLotteryTickets: remainingLotteryTickets // 남은 복권 수 저장
    };
    FileStream.saveJson("/storage/emulated/0/ChatBot/database/백업.txt", saveData);
}

// 데이터 로드 함수
function load() {
    try {
        var loadData = JSON.parse(FileStream.read("/storage/emulated/0/ChatBot/database/백업.txt"));
        userFavorability = loadData.userFavorability || {};
        blockedUsers = loadData.blockedUsers || []; // 차단된 사용자 리스트 로드
        responseEnabled = loadData.responseEnabled !== undefined ? loadData.responseEnabled : true; // 응답 활성화 여부 로드
        userSeotdaData = loadData.userSeotdaData || {}; // 사용자 섯다 데이터 로드
        loanData = loadData.loanData || {}; // 대출 데이터 불러오기
        bombPoints = loadData.bombPoints || 0; // 폭탄 포인트 로드
        lastApartmentGameTime = loadData.lastApartmentGameTime || {}; // 마지막 아파트게임 참여 시간 로드
        remainingLotteryTickets = loadData.remainingLotteryTickets || 0; // 남은 복권 수 로드
    } catch (e) {
        // 데이터 로드 실패 시 아무것도 초기화하지 않음
    }
}

// 채팅 명령어 처리
function response(room, msg, sender, isGroupChat, replier) {
    if (msg.startsWith("포커게임")) {
        var result = pokerGame(sender);
        replier.reply(result);
    }
    // 추가적인 명령어 처리 구현 가능
}
