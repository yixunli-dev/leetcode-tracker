import { useEffect, useState } from "react";
import "./App.css";

const defaultProblems = [
  {
    id: 1,
    title: "Two Sum",
    difficulty: "Easy",
    topic: "Array",
    status: "Not Started",
    description:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
  },
  {
    id: 2,
    title: "Binary Search",
    difficulty: "Easy",
    topic: "Binary Search",
    status: "Not Started",
    description:
      "Given a sorted array and a target value, return the index if the target is found. Otherwise, return -1.",
  },
  {
    id: 3,
    title: "Rotting Oranges",
    difficulty: "Medium",
    topic: "BFS",
    status: "Not Started",
    description:
      "Given a grid where 0 means empty, 1 means fresh orange, and 2 means rotten orange, return the minimum number of minutes until no fresh orange remains.",
  },
];

function App() {
  const [problems, setProblems] = useState(() => {
    const savedProblems = localStorage.getItem("problems");

    if (savedProblems) {
      return JSON.parse(savedProblems);
    }

    return defaultProblems;
  });

  const [selectedProblemId, setSelectedProblemId] = useState(
    problems[0]?.id || null,
  );
  const [notes, setNotes] = useState(() => {
    const savedNotes = localStorage.getItem("notes");

    if (savedNotes) {
      return JSON.parse(savedNotes);
    }

    return {};
  });

  const [topicFilter, setTopicFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [newTitle, setNewTitle] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("Easy");
  const [newTopic, setNewTopic] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    localStorage.setItem("problems", JSON.stringify(problems));
  }, [problems]);

  useEffect(() => {
    localStorage.setItem("notes", JSON.stringify(notes));
  }, [notes]);

  const selectedProblem = problems.find((problem) => {
    return problem.id === selectedProblemId;
  });

  const topics = ["All"];

  for (let i = 0; i < problems.length; i++) {
    if (!topics.includes(problems[i].topic)) {
      topics.push(problems[i].topic);
    }
  }

  const filteredProblems = problems.filter((problem) => {
    const matchesTopic = topicFilter === "All" || problem.topic === topicFilter;

    const matchesStatus =
      statusFilter === "All" || problem.status === statusFilter;

    const matchesDifficulty =
      difficultyFilter === "All" || problem.difficulty === difficultyFilter;

    const matchesSearch = problem.title
      .toLowerCase()
      .includes(searchText.toLowerCase());

    return matchesTopic && matchesStatus && matchesDifficulty && matchesSearch;
  });

  function handleNoteChange(event) {
    const newNote = event.target.value;

    setNotes({
      ...notes,
      [selectedProblemId]: newNote,
    });
  }

  function handleStatusChange(newStatus) {
    const updatedProblems = problems.map((problem) => {
      if (problem.id === selectedProblemId) {
        return {
          ...problem,
          status: newStatus,
        };
      }

      return problem;
    });

    setProblems(updatedProblems);
  }

  function handleDeleteProblem() {
    if (!selectedProblem) {
      return;
    }

    const updatedProblems = problems.filter((problem) => {
      return problem.id !== selectedProblemId;
    });

    const updateNotes = { ...notes };
    delete updateNotes[selectedProblemId];

    setProblems(updatedProblems);
    setNotes(updatedNotes);

    if (updatedProblems.length > 0) {
      setSelectedProblemId(updatedProblems[0].id);
    } else {
      setSelectedProblemId(null);
    }
  }

  function handleAddProblem(event) {
    event.preventDefault();

    if (
      newTitle.trim() === "" ||
      newTopic.trim() === "" ||
      newDescription.trim() === ""
    ) {
      return;
    }

    const newProblem = {
      id: Date.now(),
      title: newTitle,
      difficulty: newDifficulty,
      topic: newTopic,
      status: "Not Started",
      description: newDescription,
    };

    const updatedProblems = [...problems, newProblem];

    setProblems(updatedProblems);
    setSelectedProblemId(newProblem.id);

    setNewTitle("");
    setNewDifficulty("Easy");
    setNewTopic("");
    setNewDescription("");
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h2>LeetCode Tracker</h2>

        <div className="filter-box">
          <label>Search Problem</label>
          <input
            placeholder="Search by title..."
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
            }}
          />
        </div>

        <div className="filter-box">
          <label>Topic Filter</label>
          <select
            value={topicFilter}
            onChange={(event) => {
              setTopicFilter(event.target.value);
            }}
          >
            {topics.map((topic) => {
              return (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              );
            })}
          </select>
        </div>

        <div className="filter-box">
          <lable>Status Filter</lable>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
            }}
          >
            <option value="All">All</option>
            <option value="Not Started">Not Started</option>
            <option value="Solved">Solved</option>
            <option value="Need Review">Need Review</option>
          </select>
        </div>

        <div className="filter-box">
          <label>Difficulty Filter</label>
          <select
            value={difficultyFilter}
            onChange={(event) => {
              setDifficultyFilter(event.target.value);
            }}
          >
            <option value="All">All</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>

        <div className="problem-list">
          {filteredProblems.length === 0 ? (
            <p className="empty-text">No problems found.</p>
          ) : (
            filteredProblems.map((problem) => {
              return (
                <button
                  key={problem.id}
                  className={
                    problem.id === selectedProblemId
                      ? "problem-card active"
                      : "problem-card"
                  }
                  onClick={() => {
                    setSelectedProblemId(problem.id);
                  }}
                >
                  <div className="problem-title">{problem.title}</div>

                  <div className="problem-meta">
                    <span>{problem.difficult}</span>
                    <span>{problem.topic}</span>
                  </div>

                  <div className="status-text">{problem.status}</div>
                </button>
              );
            })
          )}
        </div>

        <form className="add-form" onSubmit={handleAddProblem}>
          <h3>Add Problem</h3>

          <input
            placeholder="Problem title"
            value={newTitle}
            onChange={(event) => {
              setNewTitle(event.target.value);
            }}
          />

          <select
            value={newDifficulty}
            onChange={(event) => {
              setNewDifficulty(event.target.value);
            }}
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <input
            placeholder="Topic"
            value={newTopic}
            onChange={(event) => {
              setNewTopic(event.target.value);
            }}
          />

          <textarea
            placeholder="Problem description"
            value={newDescription}
            onChange={(event) => {
              setNewDescription(event.target.value);
            }}
          />

          <button type="submit">Add</button>
        </form>
      </div>

      <div className="content">
        {selectedProblem ? (
          <>
            <div className="problem-panel">
              <div className="problem-header">
                <div>
                  <h1>{selectedProblem.title}</h1>

                  <div>
                    <span className="tag">{selectedProblem.difficult}</span>
                    <span className="tag">{selectedProblem.topic}</span>
                    <span className="tag">{selectedProblem.status}</span>
                  </div>
                </div>

                <button className="delete-button" onClick={handleDeleteProblem}>
                  Delete
                </button>
              </div>

              <p>{selectedProblem.description}</p>
              <div className="status-box">
                <label>Update Status</label>
                <select
                  value={selectedProblem.status}
                  onChange={(event) => {
                    handleStatusChange(event.target.value);
                  }}
                >
                  <option value="Not Started">Not Started</option>
                  <option value="Solved">Solved</option>
                  <option value="Need Review">Need Review</option>
                </select>
              </div>
            </div>

            <div className="answer-panel">
              <h2>My Notes / Solution</h2>

              <textarea
                className="note-box"
                value={notes[selectedProblemId] || ""}
                onChange={handleNoteChange}
                placeholder="Write your idea, code, time complexity, mistakes, or summary here..."
              />
            </div>
          </>
        ) : (
          <p>No problem selected.</p>
        )}
      </div>
    </div>
  );
}

export default App;
